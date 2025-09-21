import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import path from 'path'

// Fetch é nativo no Node.js 18+
const fetch = globalThis.fetch

// Configurações do bot
const config = {
    botName: '🤖 Bot Moderador',
    ownerNumber: '', // Número do dono do bot (formato: 5511999999999)
    admins: [], // Números dos admins (será carregado do config.json)
    prefix: '!',
    autoWelcome: true,
    donation: {
        pixKey: '7789f18e-3562-421e-b98b-688c7b402039',
        message: '💡 Este bot roda 24h no meu celular via Termux. Manter ele online tem custos de energia e internet.'
    }
}

// Estado do bot para o painel web
let botStats = {
    connected: false,
    totalMessages: 0,
    groups: [],
    startTime: new Date(),
    connectionTime: null,  // Quando o bot conectou de fato
    lastWelcome: 0  // Rate limiting para boas-vindas
}

// Configuração web (para integração com painel)
let webConfig = null
let webServer = null

// Tentar carregar servidor web (apenas se não estiver rodando externamente)
try {
    // Verificar se o servidor web deve ser carregado internamente
    const shouldLoadWebServer = !process.env.EXTERNAL_WEB_SERVER && process.argv.includes('--with-web')
    
    if (shouldLoadWebServer) {
        webServer = await import('./web/server.js')
        console.log('🌐 Integração com painel web carregada internamente')
    } else {
        console.log('🌐 Painel web em modo externo (use npm run web separadamente)')
    }
} catch (error) {
    console.log('⚠️ Painel web não disponível (execute npm run web em outro terminal)')
}

// Mensagem de regras que será enviada para novos membros
const WELCOME_MESSAGE = `🔴 *Regras do Grupo* 🔴

*[1°]* Respeito sempre – sem insultos, preconceitos ou ofensas.

*[2°]* Proibido spam – nada de flood, links irrelevantes ou propaganda sem permissão.

*[3°]* Foque no tema do grupo.

*[4°]* Sem conteúdo impróprio (pornografia, violência extrema, ilegal).

*[5°]* Discussões construtivas sim, brigas não.

*[6°]* Evite fake news – confirme antes de compartilhar.

*[7°]* Respeite os admins e suas decisões.

*[8°]* Idade mínima: 15+.

*[9°]* Proibida venda, serviços ou jogos de azar.

*[10°]* O contato com os administradores deve ser feito exclusivamente no grupo (não pode ir no privado).

*[11°]* Envio de APKs permitidos apenas de sites confiáveis e sem anúncios. APKs puros são restritos a administradores, garantindo a segurança.

⚠️ *Quebrar regras = banimento* ⚠️`

// Carregar configurações dos admins
function loadConfig() {
    try {
        if (fs.existsSync('./config.json')) {
            const configData = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))
            config.admins = configData.admins || []
            config.ownerNumber = configData.ownerNumber || ''
            console.log('📋 Configurações carregadas:', config.admins.length, 'admins configurados')
        } else {
            console.log('⚠️ Arquivo config.json não encontrado. Criando arquivo exemplo...')
            createExampleConfig()
        }
    } catch (error) {
        console.error('❌ Erro ao carregar configurações:', error.message)
        createExampleConfig()
    }
}

// Carregar configurações do painel web
async function loadWebConfig() {
    try {
        if (webServer && webServer.getWebConfig) {
            webConfig = webServer.getWebConfig()
            if (webConfig.settings) {
                config.autoWelcome = webConfig.settings.autoWelcome !== false
            }
            console.log('🌐 Configurações web carregadas')
        } else {
            console.log('🌐 Tentando carregar configurações via HTTP...')
            const loaded = await loadWebConfigHTTP()
            if (!loaded) {
                console.log('🌐 Configurações web não disponíveis (modo independente)')
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar configurações web:', error.message)
    }
}

// Atualizar status para o painel web  
function updateWebStatus(sock) {
    if (!webServer || !webServer.updateBotStatus) {
        // Servidor web não carregado, tentar via HTTP
        updateWebStatusHTTP(sock)
        return
    }
    
    try {
        botStats.connected = !!sock?.user?.id
        botStats.lastUpdate = new Date()
        
        webServer.updateBotStatus(botStats)
    } catch (error) {
        console.error('❌ Erro ao atualizar status web:', error.message)
    }
}

// Atualizar status via HTTP (quando rodando separadamente)
async function updateWebStatusHTTP(sock) {
    try {
        botStats.connected = !!sock?.user?.id
        botStats.lastUpdate = new Date()
        botStats.groups = await getGroupsList(sock)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
        
        const response = await fetch('http://localhost:3000/api/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(botStats),
            signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
            console.log('🌐 Status sincronizado com painel web via HTTP')
        } else {
            console.log('⚠️ Erro HTTP ao sincronizar:', response.status)
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⚠️ Timeout ao sincronizar com painel web')
        } else {
            console.log('⚠️ Não foi possível sincronizar com painel web:', error.message)
        }
    }
}

// Carregar configurações via HTTP (quando rodando separadamente)  
async function loadWebConfigHTTP() {
    try {
        console.log('🔄 Carregando configurações completas do painel web...')
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
        
        // Carregar settings
        const settingsResponse = await fetch('http://localhost:3000/api/settings', {
            signal: controller.signal
        })
        
        // Carregar comandos customizados
        const commandsResponse = await fetch('http://localhost:3000/api/commands', {
            signal: controller.signal
        })
        
        // Carregar grupos ativos
        const groupsResponse = await fetch('http://localhost:3000/api/groups', {
            signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (settingsResponse.ok && commandsResponse.ok && groupsResponse.ok) {
            const settingsData = await settingsResponse.json()
            const commandsData = await commandsResponse.json()
            const groupsData = await groupsResponse.json()
            
            if (settingsData.success && commandsData.success && groupsData.success) {
                webConfig = {
                    settings: settingsData.data,
                    customCommands: commandsData.data || [],
                    activeGroups: groupsData.data.activeGroups || {}
                }
                
                config.autoWelcome = webConfig.settings.autoWelcome !== false
                
                console.log('🌐 Configurações web carregadas via HTTP')
                console.log(`⚙️ Settings: ${Object.keys(webConfig.settings).length} configurações carregadas`)
                console.log(`📝 Comandos customizados: ${webConfig.customCommands.length} comandos carregados`)
                console.log(`👥 Grupos configurados: ${Object.keys(webConfig.activeGroups).length} grupos`)
                
                // Log dos comandos para debug
                if (webConfig.customCommands.length > 0) {
                    console.log('🎯 Comandos disponíveis:')
                    webConfig.customCommands.forEach(cmd => {
                        console.log(`   - !${cmd.command} (${cmd.adminOnly ? 'admin' : 'público'}): ${cmd.response?.substring(0, 40)}...`)
                    })
                } else {
                    console.log('⚠️ Nenhum comando customizado configurado no painel web')
                }
                
                return true
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⚠️ Timeout ao carregar configurações web (5s)')
        } else {
            console.log('⚠️ Não foi possível carregar configurações web via HTTP:', error.message)
        }
    }
    return false
}

// Verificar se é seguro enviar mensagem de boas-vindas
function isSafeToSendWelcome(sock, participants, groupId) {
    // 1. Verificar se o bot conectou há pelo menos 2 minutos (evitar sincronização inicial)
    if (!botStats.connectionTime) {
        return false
    }
    
    const timeSinceConnection = Date.now() - botStats.connectionTime.getTime()
    const minTimeRequired = 2 * 60 * 1000 // 2 minutos em ms
    
    if (timeSinceConnection < minTimeRequired) {
        return false
    }
    
    // 2. Verificar se não é o próprio bot sendo adicionado
    const botNumber = sock?.user?.id?.split(':')[0]
    if (botNumber && participants.some(p => p.includes(botNumber))) {
        return false
    }
    
    // 3. Verificar se participantes não são vazios
    if (!participants || participants.length === 0) {
        return false
    }
    
    // 4. Verificar se não é uma adição em massa suspicinha (mais de 5 pessoas)
    if (participants.length > 5) {
        console.log('⚠️ Boas-vindas: Adição em massa detectada, ignorando por segurança')
        return false
    }
    
    // 5. Rate limiting - não enviar boas-vindas muito frequentes
    const lastWelcome = botStats.lastWelcome || 0
    const minWelcomeInterval = 10 * 1000 // 10 segundos entre boas-vindas
    
    if (Date.now() - lastWelcome < minWelcomeInterval) {
        console.log('⚠️ Boas-vindas: Rate limit ativo, aguardando')
        return false
    }
    
    return true
}

// Obter lista de grupos
async function getGroupsList(sock) {
    if (!sock) return []
    
    try {
        const groups = await sock.groupFetchAllParticipating()
        return Object.values(groups).map(group => ({
            id: group.id,
            subject: group.subject || 'Sem nome',
            participants: group.participants?.length || 0,
            creation: group.creation || 0,
            owner: group.owner || null,
            desc: group.desc || null
        }))
    } catch (error) {
        console.error('❌ Erro ao obter grupos:', error.message)
        // Retornar grupos em cache se disponível
        return botStats.groups || []
    }
}

// Verificar se grupo está ativo
function isGroupActive(groupId) {
    if (!webConfig) {
        console.log('🌐 WebConfig não disponível, grupo ativo por padrão:', groupId)
        return true // Padrão: todos ativos
    }
    
    // Verificar se activeGroups existe antes de acessar
    if (!webConfig.activeGroups) {
        console.log('🌐 ActiveGroups não configurado, grupo ativo por padrão:', groupId)
        return true
    }
    
    const isActive = webConfig.activeGroups[groupId] !== false
    console.log('🌐 Status do grupo', groupId, ':', isActive ? 'ATIVO' : 'INATIVO')
    return isActive
}

// Obter comandos customizados (com reload dinâmico)
async function getCustomCommands(forceReload = false) {
    // Se forceReload é true ou não temos configuração, recarregar
    if (forceReload || !webConfig || !webConfig.customCommands) {
        console.log('🔄 [CUSTOM CMD] Recarregando comandos customizados...')
        await loadWebConfig()
    }
    
    if (!webConfig) {
        console.log('⚠️ [CUSTOM CMD] webConfig não disponível')
        return []
    }
    
    const commands = webConfig.customCommands || []
    console.log(`📝 [CUSTOM CMD] ${commands.length} comandos customizados disponíveis em webConfig`)
    
    return commands
}

// Processar comando customizado
async function processCustomCommand(command, message, sock, senderNumber, groupId, isUserAdmin) {
    const customCommands = await getCustomCommands()
    
    console.log(`🔍 [CUSTOM CMD] Procurando comando '${command}' entre ${customCommands.length} comandos`)
    if (customCommands.length > 0) {
        console.log(`📝 [CUSTOM CMD] Comandos disponíveis: ${customCommands.map(c => c.command).join(', ')}`)
    }
    
    let customCommand = customCommands.find(c => c.command === command)
    
    // Se não encontrou o comando, tentar recarregar uma vez
    if (!customCommand) {
        console.log(`🔄 [CUSTOM CMD] Comando '${command}' não encontrado, tentando reload...`)
        const reloadedCommands = await getCustomCommands(true)
        customCommand = reloadedCommands.find(c => c.command === command)
    }
    
    if (!customCommand) {
        console.log(`❌ [CUSTOM CMD] Comando '${command}' não encontrado mesmo após reload`)
        return false
    }
    
    console.log(`✅ [CUSTOM CMD] Comando '${command}' encontrado! AdminOnly: ${customCommand.adminOnly}, IsUserAdmin: ${isUserAdmin}`)
    
    // Verificar permissões
    if (customCommand.adminOnly && !isUserAdmin) {
        await sock.sendMessage(groupId, {
            text: '❌ Este comando é restrito a administradores.',
            quoted: message
        })
        return true
    }
    
    // Processar resposta
    let response = customCommand.response
    
    // Substituir variáveis
    const userNumber = senderNumber.replace('@s.whatsapp.net', '')
    response = response.replace(/{user}/g, `@${userNumber}`)
    
    // Enviar resposta
    const mentions = response.includes(`@${userNumber}`) ? [senderNumber] : []
    
    await sock.sendMessage(groupId, {
        text: response,
        mentions,
        quoted: message
    })
    
    // Atualizar contadores
    try {
        customCommand.usage = (customCommand.usage || 0) + 1
        if (webServer) {
            // Salvar uso atualizado (implementar se necessário)
        }
    } catch (error) {
        console.error('Erro ao atualizar contador de uso:', error)
    }
    
    console.log(`⚡ Comando customizado executado: !${command} por ${userNumber}`)
    return true
}

// Criar arquivo de configuração de exemplo
function createExampleConfig() {
    const exampleConfig = {
        ownerNumber: "5511999999999",
        admins: [
            "5511999999999",
            "5511888888888"
        ]
    }
    fs.writeFileSync('./config.json', JSON.stringify(exampleConfig, null, 2))
    console.log('✅ Arquivo config.json criado! Edite-o com os números dos administradores.')
}

// Verificar se o usuário é admin
async function isAdmin(userNumber, sock = null, groupId = null) {
    const cleanNumber = userNumber.replace('@s.whatsapp.net', '').replace(/:.*/, '')
    
    console.log(`🔍 [DEBUG ADMIN] Verificando: ${cleanNumber}`)
    
    // 1. Verificar se é admin configurado ou owner configurado
    let isAdminUser = config.admins.includes(cleanNumber) || cleanNumber === config.ownerNumber
    console.log(`📋 [DEBUG ADMIN] Admin/Owner configurado: ${isAdminUser}`)
    
    // 2. Verificar se é o dono do número conectado ao bot
    if (sock && sock.user && sock.user.id) {
        const botOwnerNumber = sock.user.id.replace(/:.*/, '').replace('@s.whatsapp.net', '')
        console.log(`🤖 [DEBUG ADMIN] Bot owner: ${botOwnerNumber}, User: ${cleanNumber}`)
        if (cleanNumber === botOwnerNumber) {
            console.log(`👑 [DEBUG ADMIN] É o dono do bot!`)
            isAdminUser = true
        }
    }
    
    // 3. NOVO: Verificar se é admin do grupo atual
    if (!isAdminUser && sock && groupId && groupId.endsWith('@g.us')) {
        try {
            console.log(`👥 [DEBUG ADMIN] Verificando admin do grupo: ${groupId}`)
            const groupMetadata = await sock.groupMetadata(groupId)
            const participant = groupMetadata.participants.find(p => {
                const participantNumber = p.id.replace('@s.whatsapp.net', '')
                return participantNumber === cleanNumber || 
                       p.id === userNumber || 
                       p.id === (cleanNumber + '@s.whatsapp.net')
            })
            
            if (participant) {
                console.log(`👤 [DEBUG ADMIN] Participante encontrado: ${participant.id}, admin: ${participant.admin}`)
                if (participant.admin === 'admin' || participant.admin === 'superadmin') {
                    console.log(`🛡️ [DEBUG ADMIN] É admin do grupo!`)
                    isAdminUser = true
                }
            } else {
                console.log(`⚠️ [DEBUG ADMIN] Participante não encontrado no grupo`)
            }
        } catch (error) {
            console.error('❌ [DEBUG ADMIN] Erro ao verificar admins do grupo:', error.message)
        }
    }
    
    console.log(`🎯 [DEBUG ADMIN] RESULTADO FINAL: ${isAdminUser}`)
    return isAdminUser
}

// Extrair número mencionado na mensagem
function getMentionedNumber(message) {
    const extendedText = message.message?.extendedTextMessage
    let mentionedJid = null
    
    // Tentar pegar da mensagem extendida
    if (extendedText?.contextInfo?.mentionedJid) {
        mentionedJid = extendedText.contextInfo.mentionedJid[0]
    }
    
    // Se não encontrou, tentar pegar de participant (para mensagens quotadas)
    if (!mentionedJid && extendedText?.contextInfo?.participant) {
        mentionedJid = extendedText.contextInfo.participant
    }
    
    if (mentionedJid) {
        const cleanNumber = mentionedJid.replace('@s.whatsapp.net', '')
        return cleanNumber
    }
    
    return null
}

// Função principal do bot
async function startBot() {
    // Carregar configurações
    loadConfig()
    await loadWebConfig()  // Agora é async
    
    let sock = null // Declare sock variable

    // Estado de autenticação
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
    
    // Criar socket do WhatsApp
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Bot Moderador', 'Desktop', '1.0.0']
    })

    // Salvar credenciais quando atualizadas
    sock.ev.on('creds.update', saveCreds)

    // Gerenciar conexão
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp!')
            qrcode.generate(qr, { small: true })
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error && new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut)
            console.log('❌ Conexão fechada devido a:', lastDisconnect?.error, ', reconectando:', shouldReconnect)
            
            botStats.connected = false
            updateWebStatus(sock)
            
            if (shouldReconnect) {
                startBot()
            }
        } else if (connection === 'open') {
            console.log('✅ Bot conectado ao WhatsApp!')
            console.log('🤖 Bot está ativo e monitorando mensagens...')
            
            // Registrar momento da conexão
            botStats.connectionTime = new Date()
            console.log('⏰ Conexão estabelecida às:', botStats.connectionTime.toLocaleTimeString())
            
            // Atualizar status web
            botStats.connected = true
            botStats.groups = await getGroupsList(sock)
            updateWebStatus(sock)
            
            // Aguardar um pouco para sincronização
            setTimeout(async () => {
                console.log('🔄 Sincronizando dados iniciais...')
                if (sock?.user?.id) {
                    await updateWebStatusHTTP(sock)
                }
            }, 3000)
            
            // Configurar recarregamento automático das configurações web a cada 30 segundos
            const configReloadInterval = setInterval(async () => {
                try {
                    const oldCommandsCount = webConfig?.customCommands?.length || 0
                    await loadWebConfig()
                    const newCommandsCount = webConfig?.customCommands?.length || 0
                    
                    if (newCommandsCount !== oldCommandsCount) {
                        console.log(`🔄 [AUTO-RELOAD] Comandos customizados atualizados: ${oldCommandsCount} → ${newCommandsCount}`)
                        if (webConfig?.customCommands?.length > 0) {
                            console.log(`📝 [AUTO-RELOAD] Comandos disponíveis: ${webConfig.customCommands.map(c => c.command).join(', ')}`)
                        }
                    }
                } catch (error) {
                    console.log('⚠️ [AUTO-RELOAD] Erro ao recarregar configurações automaticamente:', error.message)
                }
            }, 30000) // 30 segundos
            
            console.log('🔄 Auto-reload de configurações ativado (a cada 30 segundos)')
            
            if (webServer) {
                console.log('🌐 Painel web integrado - Status sincronizado')
            }
        }
    })

    // Gerenciar atualizações de grupos (novos membros)
    sock.ev.on('group-participants.update', async (update) => {
        if (!config.autoWelcome) {
            console.log('📋 Boas-vindas desabilitadas na configuração')
            return
        }

        const { id: groupId, participants, action, author } = update
        
        console.log('\n🔄 === EVENT: group-participants.update ===')
        console.log('📍 Grupo:', groupId)
        console.log('👥 Participantes afetados:', participants?.length || 0)
        console.log('⚡ Ação:', action)
        console.log('👤 Autor (quem fez a ação):', author || 'Sistema')
        console.log('⏰ Timestamp:', new Date().toLocaleTimeString())
        
        if (action === 'add') {
            console.log('➕ Ação de ADICIONAR detectada')
            
            // Verificar se é seguro enviar boas-vindas
            if (!isSafeToSendWelcome(sock, participants, groupId)) {
                console.log('❌ Não é seguro enviar boas-vindas agora, pulando...')
                console.log('========================================\n')
                return
            }
            
            // Aguardar um pouco antes de enviar a mensagem (dar tempo para participante carregar)
            console.log('✅ Enviando mensagem de boas-vindas em 3 segundos...')
            setTimeout(async () => {
                try {
                    await sock.sendMessage(groupId, {
                        text: WELCOME_MESSAGE
                    })
                    
                    // Atualizar timestamp da última boas-vindas
                    botStats.lastWelcome = Date.now()
                    
                    console.log('📨✅ Mensagem de boas-vindas enviada com sucesso para o grupo:', groupId)
                    console.log('👋 Novos membros:', participants.map(p => p.replace('@s.whatsapp.net', '')).join(', '))
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem de boas-vindas:', error.message)
                    // Se der erro, não atualizar o timestamp para poder tentar novamente
                }
            }, 3000)
        } else {
            console.log(`ℹ️ Ação '${action}' não requer boas-vindas`)
        }
        
        console.log('========================================\n')
    })

    // Gerenciar mensagens recebidas
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0]
        if (!message.message) {
            console.log('⚠️ Mensagem sem conteúdo, ignorando...')
            return
        }

        const messageText = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || ''
        
        // Se for mensagem própria, só processar se for comando
        if (message.key.fromMe) {
            if (!messageText.startsWith(config.prefix)) {
                console.log('🤖 Mensagem própria sem comando, ignorando...')
                return // Ignorar mensagens próprias que não são comandos
            } else {
                console.log('👑 🔥 MENSAGEM PRÓPRIA COM COMANDO DETECTADA! Processando...')
            }
        }
        const isGroup = message.key.remoteJid?.endsWith('@g.us')
        const senderNumber = message.key.fromMe 
            ? sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net'
            : (message.key.participant || message.key.remoteJid)
        const groupId = message.key.remoteJid

        // Log simplificado - apenas para comandos
        if (messageText.startsWith(config.prefix)) {
            console.log(`📨 Comando recebido: ${messageText} - Grupo: ${isGroup} - Remetente: ${senderNumber.replace('@s.whatsapp.net', '')}`)
        }

        // Contar mensagem processada
        botStats.totalMessages++
        
        // Verificar se grupo está ativo (apenas se não for comando de config)
        if (isGroup && !messageText.startsWith('!botadmin') && !messageText.startsWith('!debug')) {
            console.log('🔍 Verificando se grupo está ativo:', groupId)
            if (!isGroupActive(groupId)) {
                console.log('⏸️ Grupo inativo, ignorando mensagem')
                return
            }
            console.log('✅ Grupo ativo, continuando processamento')
        }

        // Processar comandos apenas em grupos
        if (isGroup && messageText.startsWith(config.prefix)) {
            console.log('🎆 COMANDO DETECTADO! Processando...')
            const args = messageText.slice(config.prefix.length).trim().split(' ')
            const command = args[0].toLowerCase()
            console.log('🔥 Comando extraído:', command)
            console.log('📋 Argumentos:', args)

            // Verificar se é comando customizado primeiro
            const isUserAdmin = await isAdmin(senderNumber, sock, groupId)
            console.log('👑 Usuário é admin?', isUserAdmin)
            
            if (await processCustomCommand(command, message, sock, senderNumber, groupId, isUserAdmin)) {
                // Comando customizado processado
                console.log('⚡ Comando customizado processado')
                updateWebStatus(sock)
                return
            }

            // Comando para remover usuário (!kick @usuario)
            if (command === 'kick' || command === 'remover' || command === 'remove') {
                console.log('🔨 === PROCESSANDO COMANDO KICK ===')
                console.log('🔨 Comando kick executado por:', senderNumber)
                
                // Verificar se o remetente é admin
                if (!(await isAdmin(senderNumber, sock, groupId))) {
                    console.log('❌ Usuário não é admin')
                    await sock.sendMessage(groupId, {
                        text: '❌ Você não tem permissão para usar este comando.\n\n📝 Para usar comandos administrativos você deve ser:\n• Admin do grupo atual\n• Owner/Admin configurado no bot\n• Dono do número conectado',
                        quoted: message
                    })
                    return
                }

                console.log('✅ Usuário é admin, processando menção...')
                
                // Verificar se há usuário mencionado
                const mentionedNumber = getMentionedNumber(message)
                if (!mentionedNumber) {
                    console.log('❌ Nenhum usuário mencionado')
                    await sock.sendMessage(groupId, {
                        text: '❌ Você precisa mencionar um usuário para remover.\nUso: `!kick @usuario`\n\n💡 Certifique-se de mencionar o usuário (@) na mensagem.',
                        quoted: message
                    })
                    return
                }

                console.log('🎯 Tentando remover usuário:', mentionedNumber)
                
                try {
                    // Verificar se o bot tem permissões no grupo
                    const groupMetadata = await sock.groupMetadata(groupId)
                    
                    // Extrair número do bot corretamente
                    const botRawId = sock.user.id
                    const botNumber = botRawId.split(':')[0]  // Pega apenas a parte antes do ':'
                    const botJid = botNumber + '@s.whatsapp.net'
                    
                    console.log('🔍 === VERIFICAÇÃO DO BOT COMO ADMIN ===')
                    console.log('🤖 Bot ID bruto:', botRawId)
                    console.log('🤖 Bot número extraído:', botNumber)
                    console.log('🤖 Bot JID completo:', botJid)
                    console.log('👥 Total de participantes:', groupMetadata.participants.length)
                    
                    // Encontrar bot na lista de participantes
                    const botParticipant = groupMetadata.participants.find(p => {
                        console.log('🔍 Comparando:', p.id, 'com', botJid)
                        return p.id === botJid || p.id.includes(botNumber)
                    })
                    
                    console.log('👤 Bot encontrado:', !!botParticipant)
                    console.log('🛡️ Status do bot:', botParticipant?.admin || 'member')
                    console.log('===========================================')
                    
                    if (!botParticipant) {
                        await sock.sendMessage(groupId, {
                            text: '❌ Erro: Bot não encontrado na lista de participantes do grupo.\n\n🤖 O bot precisa estar no grupo para funcionar.\n📱 Verifique se o bot foi removido acidentalmente.',
                            quoted: message
                        })
                        return
                    }
                    
                    if (!botParticipant.admin) {
                        // Listar quem são os admins para ajudar o usuário
                        const groupAdmins = groupMetadata.participants
                            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                            .map(p => p.id.replace('@s.whatsapp.net', ''))
                        
                        await sock.sendMessage(groupId, {
                            text: `❌ Erro: O bot não é administrador do grupo.\n\n📄 **Como resolver:**\n1. Abra "Informações do grupo"\n2. Toque em "Participantes"\n3. Encontre o bot na lista\n4. Toque no nome do bot\n5. Selecione "Tornar administrador"\n\n👥 **Admins atuais:** ${groupAdmins.length}\n${groupAdmins.map(admin => `• ${admin}`).join('\n')}\n\n🤖 **Bot:** ${botNumber} (precisa ser promovido)`,
                            quoted: message
                        })
                        return
                    }
                    
                    // Remover o usuário do grupo
                    const targetJid = mentionedNumber + '@s.whatsapp.net'
                    console.log('🎯 Removendo:', targetJid)
                    
                    const result = await sock.groupParticipantsUpdate(groupId, [targetJid], 'remove')
                    console.log('📤 Resultado da remoção:', result)
                    
                    await sock.sendMessage(groupId, {
                        text: `✅ Usuário foi removido do grupo pelos administradores.\n\n👤 Removido por: Admin\n⚖️ Motivo: Comando administrativo`,
                        quoted: message
                    })
                    
                    console.log(`🔨 Admin ${senderNumber} removeu ${mentionedNumber} do grupo ${groupId}`)
                    
                } catch (error) {
                    console.error('❌ Erro detalhado ao remover usuário:', error)
                    console.error('📋 Stack trace:', error.stack)
                    
                    let errorMessage = '❌ Erro ao remover usuário.\n\n'
                    
                    if (error.output?.statusCode === 403) {
                        errorMessage += '🚫 O bot não tem permissão para remover este usuário.\n• Verifique se o bot é administrador do grupo\n• O usuário pode ser um admin que não pode ser removido'
                    } else if (error.output?.statusCode === 404) {
                        errorMessage += '👻 Usuário não encontrado no grupo ou já foi removido.'
                    } else {
                        errorMessage += `🔍 Detalhes técnicos: ${error.message}\n\n💡 Possíveis soluções:\n• Certifique-se que o bot é admin\n• Verifique se o usuário ainda está no grupo\n• Tente novamente em alguns segundos`
                    }
                    
                    await sock.sendMessage(groupId, {
                        text: errorMessage,
                        quoted: message
                    })
                }
            }

            // Comando de ajuda
            if (command === 'help' || command === 'ajuda') {
                console.log('🎆 === PROCESSANDO COMANDO HELP ===')
                const isUserAdmin = await isAdmin(senderNumber, sock, groupId)
                let helpText = `🤖 *Comandos do Bot*

*Para Administradores:*
• \`${config.prefix}kick @usuario\` - Remove um usuário do grupo
• \`${config.prefix}remover @usuario\` - Remove um usuário do grupo`

                if (isUserAdmin) {
                    helpText += `
• \`${config.prefix}debug\` - Informações técnicas do bot
• \`${config.prefix}testmention @usuario\` - Testar detecção de menções
• \`${config.prefix}testowner\` - Testar se você é reconhecido como dono
• \`${config.prefix}botadmin\` - Verificar se bot é admin do grupo
• \`${config.prefix}reload\` - 🔄 Recarregar comandos customizados`
                }

                helpText += `

*Geral:*
• \`${config.prefix}help\` - Mostra esta mensagem
• \`${config.prefix}regras\` - Exibe as regras do grupo
• \`${config.prefix}pix\` - Informações para doação/suporte
• \`${config.prefix}donate\` - Como apoiar o bot
• \`${config.prefix}testowner\` - Testa se você é reconhecido como dono
• \`${config.prefix}botadmin\` - Verifica se o bot é admin do grupo

*Funcionalidades Automáticas:*
✅ Mensagem de boas-vindas para novos membros
✅ Sistema de moderação administrativo
✅ Comandos personalizados dinâmicos

${!isUserAdmin ? '💡 *Você não é administrador - alguns comandos não estão visíveis*' : '👨‍💼 *Você é administrador - comandos completos disponíveis*'}

---
💡 ${config.donation.message}
❤️ Use \`${config.prefix}pix\` para apoiar o projeto!`

                await sock.sendMessage(groupId, {
                    text: helpText,
                    quoted: message
                })
            }

            // Comando para exibir regras
            if (command === 'regras' || command === 'rules') {
                console.log('📋 === PROCESSANDO COMANDO REGRAS ===')
                const rulesWithFooter = `${WELCOME_MESSAGE}

---
💡 ${config.donation.message}
❤️ Use \`${config.prefix}pix\` para apoiar o bot!`
                
                await sock.sendMessage(groupId, {
                    text: rulesWithFooter,
                    quoted: message
                })
            }

            // Comandos de doação (PIX)
            if (command === 'pix' || command === 'donate' || command === 'doar') {
                console.log('💰 === PROCESSANDO COMANDO PIX/DONATE ===')
                
                const donationMessage = `💰 *Apoie o Bot Moderador*

🤖 **Por que doar?**
${config.donation.message}

💸 **Custos mensais:**
• 🔋 Energia elétrica 24h
• 📱 Internet móvel ilimitada
• ⚡ Manutenção e atualizações
• 🛡️ Segurança e backups

📋 **Chave PIX:**
\`${config.donation.pixKey}\`

📱 **Como doar:**
1. Copie a chave PIX acima
2. Abra seu app bancário
3. Escolha PIX → Enviar
4. Cole a chave
5. Digite o valor (qualquer quantia ajuda!)

❤️ **Sua contribuição:**
• Mantém o bot online 24h
• Permite novas funcionalidades
• Garante estabilidade
• Mostra que você valoriza o serviço

🙏 **Obrigado pelo apoio!**
Cada doação, mesmo pequena, faz toda a diferença!

---
🎯 Comando: \`${config.prefix}pix\` ou \`${config.prefix}donate\`

                await sock.sendMessage(groupId, {
                    text: donationMessage,
                    quoted: message
