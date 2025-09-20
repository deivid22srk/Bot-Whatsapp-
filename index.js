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
    autoWelcome: true
}

// Estado do bot para o painel web
let botStats = {
    connected: false,
    totalMessages: 0,
    groups: [],
    startTime: new Date(),
    connectionTime: null  // Quando o bot conectou de fato
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
        
        const response = await fetch('http://localhost:3000/api/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(botStats)
        })
        
        if (response.ok) {
            console.log('🌐 Status sincronizado com painel web via HTTP')
        }
    } catch (error) {
        console.log('⚠️ Não foi possível sincronizar com painel web:', error.message)
    }
}

// Carregar configurações via HTTP (quando rodando separadamente)  
async function loadWebConfigHTTP() {
    try {
        console.log('🔄 Carregando configurações completas do painel web...')
        
        // Carregar settings
        const settingsResponse = await fetch('http://localhost:3000/api/settings')
        
        // Carregar comandos customizados
        const commandsResponse = await fetch('http://localhost:3000/api/commands')
        
        // Carregar grupos
        const groupsResponse = await fetch('http://localhost:3000/api/groups')
        
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
                console.log(`⚙️ Settings: ${Object.keys(webConfig.settings).length} configurações`)
                console.log(`📝 Comandos customizados: ${webConfig.customCommands.length} comandos carregados`)
                console.log(`👥 Grupos ativos: ${Object.keys(webConfig.activeGroups).length} grupos configurados`)
                
                // Log dos comandos para debug
                if (webConfig.customCommands.length > 0) {
                    console.log('🎯 Comandos disponíveis:')
                    webConfig.customCommands.forEach(cmd => {
                        console.log(`   - !${cmd.command} (${cmd.adminOnly ? 'admin' : 'público'}): ${cmd.response?.substring(0, 30)}...`)
                    })
                }
                
                return true
            }
        }
    } catch (error) {
        console.log('⚠️ Não foi possível carregar configurações web via HTTP:', error.message)
    }
    return false
}

// Verificar se é seguro enviar mensagem de boas-vindas
function isSafeToSendWelcome(sock, participants) {
    // 1. Verificar se o bot conectou há pelo menos 2 minutos (evitar sincronização inicial)
    if (!botStats.connectionTime) {
        console.log('⚠️ Boas-vindas: Bot não tem registro de connectionTime, ignorando')
        return false
    }
    
    const timeSinceConnection = Date.now() - botStats.connectionTime.getTime()
    const minTimeRequired = 2 * 60 * 1000 // 2 minutos em ms
    
    if (timeSinceConnection < minTimeRequired) {
        console.log(`⚠️ Boas-vindas: Bot conectou há apenas ${Math.round(timeSinceConnection/1000)}s, aguardando estabilização (mín: ${minTimeRequired/1000}s)`)
        return false
    }
    
    // 2. Verificar se não é o próprio bot sendo adicionado
    const botNumber = sock?.user?.id?.split(':')[0]
    if (botNumber && participants.some(p => p.includes(botNumber))) {
        console.log('⚠️ Boas-vindas: Próprio bot detectado nos participantes, ignorando')
        return false
    }
    
    // 3. Verificar se participantes não são vazios
    if (!participants || participants.length === 0) {
        console.log('⚠️ Boas-vindas: Lista de participantes vazia, ignorando')
        return false
    }
    
    console.log('✅ Boas-vindas: Seguro para enviar -', participants.length, 'novo(s) membro(s)')
    return true
}

// Obter lista de grupos
async function getGroupsList(sock) {
    if (!sock) return []
    
    try {
        const groups = await sock.groupFetchAllParticipating()
        return Object.values(groups).map(group => ({
            id: group.id,
            subject: group.subject,
            participants: group.participants?.length || 0,
            creation: group.creation || 0,
            owner: group.owner,
            desc: group.desc
        }))
    } catch (error) {
        console.error('❌ Erro ao obter grupos:', error.message)
        return []
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

// Obter comandos customizados
function getCustomCommands() {
    if (!webConfig) {
        console.log('⚠️ [CUSTOM CMD] webConfig não disponível')
        return []
    }
    
    const commands = webConfig.customCommands || []
    console.log(`📝 [CUSTOM CMD] ${commands.length} comandos customizados em webConfig`)
    
    return commands
}

// Processar comando customizado
async function processCustomCommand(command, message, sock, senderNumber, groupId, isUserAdmin) {
    const customCommands = getCustomCommands()
    
    console.log(`🔍 [CUSTOM CMD] Procurando comando '${command}' entre ${customCommands.length} comandos`)
    if (customCommands.length > 0) {
        console.log(`📝 [CUSTOM CMD] Comandos disponíveis: ${customCommands.map(c => c.command).join(', ')}`)
    }
    
    const customCommand = customCommands.find(c => c.command === command)
    
    if (!customCommand) {
        console.log(`❌ [CUSTOM CMD] Comando '${command}' não encontrado`)
        return false
    }
    
    console.log(`✅ [CUSTOM CMD] Comando '${command}' encontrado! AdminOnly: ${customCommand.adminOnly}`)
    
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
    console.log('\n🔐 ======== VERIFICAÇÃO DE ADMIN ========')
    console.log('🔍 Verificando admin:', cleanNumber)
    console.log('📋 Admins configurados:', config.admins)
    console.log('👑 Owner configurado:', config.ownerNumber)
    
    // 1. Verificar se é admin configurado ou owner configurado
    let isAdminUser = config.admins.includes(cleanNumber) || cleanNumber === config.ownerNumber
    console.log('✅ É admin/owner configurado?', isAdminUser)
    
    // 2. Verificar se é o dono do número conectado ao bot
    if (sock && sock.user && sock.user.id) {
        const botOwnerNumber = sock.user.id.replace(/:.*/, '').replace('@s.whatsapp.net', '')
        console.log('🤖 Número do bot conectado:', botOwnerNumber)
        console.log('🎯 Comparando:', cleanNumber, '===', botOwnerNumber)
        
        if (cleanNumber === botOwnerNumber) {
            console.log('👑 ✅ USUÁRIO É O DONO DO NÚMERO CONECTADO AO BOT!')
            isAdminUser = true
        }
    }
    
    // 3. NOVO: Verificar se é admin do grupo atual
    if (!isAdminUser && sock && groupId && groupId.endsWith('@g.us')) {
        try {
            console.log('👥 Verificando se é admin do grupo:', groupId)
            const groupMetadata = await sock.groupMetadata(groupId)
            console.log('🏠 Nome do grupo:', groupMetadata.subject)
            console.log('📄 Total de participantes:', groupMetadata.participants.length)
            
            // Encontrar participante - more robust matching
            const participant = groupMetadata.participants.find(p => {
                const participantNumber = p.id.replace('@s.whatsapp.net', '')
                console.log('🔍 Comparando participante:', participantNumber, 'com', cleanNumber)
                return participantNumber === cleanNumber || 
                       p.id === userNumber || 
                       p.id === (cleanNumber + '@s.whatsapp.net')
            })
            
            if (participant) {
                console.log('👤 Participante encontrado:', participant.id)
                console.log('🛡️ Status no grupo:', participant.admin || 'member')
                
                if (participant.admin === 'admin' || participant.admin === 'superadmin') {
                    console.log('🏅 ✅ USUÁRIO É ADMINISTRADOR DO GRUPO!')
                    isAdminUser = true
                } else {
                    console.log('❌ Usuário é apenas membro do grupo')
                }
            } else {
                console.log('⚠️ Participante não encontrado no grupo')
            }
        } catch (error) {
            console.error('❌ Erro ao verificar admins do grupo:', error.message)
        }
    }
    
    console.log('🎯 RESULTADO FINAL - É admin?', isAdminUser)
    console.log('========================================\n')
    return isAdminUser
}

// Extrair número mencionado na mensagem
function getMentionedNumber(message) {
    console.log('🔍 Analisando mensagem para menções...')
    
    // Verificar diferentes tipos de mensagem
    const extendedText = message.message?.extendedTextMessage
    const conversation = message.message?.conversation
    
    let mentionedJid = null
    
    // Tentar pegar da mensagem extendida
    if (extendedText?.contextInfo?.mentionedJid) {
        mentionedJid = extendedText.contextInfo.mentionedJid[0]
        console.log('📍 Menção encontrada em extendedText:', mentionedJid)
    }
    
    // Se não encontrou, tentar pegar de participant (para mensagens quotadas)
    if (!mentionedJid && extendedText?.contextInfo?.participant) {
        mentionedJid = extendedText.contextInfo.participant
        console.log('📍 Menção encontrada em participant:', mentionedJid)
    }
    
    // Log da estrutura completa para debug
    console.log('📨 Estrutura da mensagem:', JSON.stringify({
        hasExtendedText: !!extendedText,
        hasContextInfo: !!extendedText?.contextInfo,
        mentionedJid: extendedText?.contextInfo?.mentionedJid,
        participant: extendedText?.contextInfo?.participant,
        quotedMessage: !!extendedText?.contextInfo?.quotedMessage
    }, null, 2))
    
    if (mentionedJid) {
        const cleanNumber = mentionedJid.replace('@s.whatsapp.net', '')
        console.log('✅ Número mencionado extraído:', cleanNumber)
        return cleanNumber
    }
    
    console.log('❌ Nenhuma menção encontrada')
    return null
}

// Função principal do bot
async function startBot() {
    // Declarar variável sock
    let sock = null
    
    // Carregar configurações
    loadConfig()
    await loadWebConfig()  // Agora é async
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
            if (!isSafeToSendWelcome(sock, participants)) {
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
                    console.log('📨✅ Mensagem de boas-vindas enviada com sucesso para o grupo:', groupId)
                    console.log('👋 Novos membros:', participants.map(p => p.replace('@s.whatsapp.net', '')).join(', '))
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem de boas-vindas:', error.message)
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

        console.log('\n================ MENSAGEM RECEBIDA ==================')
        console.log('📝 Texto:', messageText)
        console.log('👥 É grupo?', isGroup)
        console.log('🤖 É mensagem própria?', message.key.fromMe)
        console.log('📱 Remetente:', senderNumber)
        console.log('🏠 ID do grupo:', groupId)
        console.log('🏷️ Começa com prefixo?', messageText.startsWith(config.prefix))
        console.log('🔑 Prefixo configurado:', config.prefix)
        console.log('==========================================')

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
• \`${config.prefix}botadmin\` - Verificar se bot é admin do grupo`
                }

                helpText += `

*Geral:*
• \`${config.prefix}help\` - Mostra esta mensagem
• \`${config.prefix}regras\` - Exibe as regras do grupo
• \`${config.prefix}testowner\` - Testa se você é reconhecido como dono
• \`${config.prefix}botadmin\` - Verifica se o bot é admin do grupo

*Funcionalidades Automáticas:*
✅ Mensagem de boas-vindas para novos membros
✅ Sistema de moderação administrativo

${!isUserAdmin ? '💡 *Você não é administrador - alguns comandos não estão visíveis*' : '👨‍💼 *Você é administrador - comandos completos disponíveis*'}`

                await sock.sendMessage(groupId, {
                    text: helpText,
                    quoted: message
                })
            }

            // Comando para exibir regras
            if (command === 'regras' || command === 'rules') {
                console.log('📋 === PROCESSANDO COMANDO REGRAS ===')
                await sock.sendMessage(groupId, {
                    text: WELCOME_MESSAGE,
                    quoted: message
                })
            }

            // Comando de debug (apenas para admins)
            if (command === 'debug' && (await isAdmin(senderNumber, sock, groupId))) {
                console.log('🔧 === PROCESSANDO COMANDO DEBUG ===')
                const botOwnerNumber = sock.user?.id?.replace(':.*', '').replace('@s.whatsapp.net', '') || 'Não disponível'
                
                // Obter informações dos admins do grupo
                let groupAdminsInfo = ''
                try {
                    const groupMetadata = await sock.groupMetadata(groupId)
                    const groupAdmins = groupMetadata.participants
                        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                        .map(p => p.id.replace('@s.whatsapp.net', ''))
                    
                    groupAdminsInfo = `
👥 *Admins do Grupo:* ${groupAdmins.length} encontrados
${groupAdmins.map(admin => `   • ${admin}`).join('\n')}`
                } catch (error) {
                    groupAdminsInfo = '\n⚠️ *Erro ao obter admins do grupo*'
                }
                
                const debugInfo = `🔧 *Informações de Debug*

📱 *Seu número:* ${senderNumber.replace('@s.whatsapp.net', '')}
👑 *Owner configurado:* ${config.ownerNumber || 'Não configurado'}
📋 *Admins configurados:* ${config.admins.length > 0 ? config.admins.join(', ') : 'Nenhum'}
🤖 *Bot número conectado:* ${botOwnerNumber}
📍 *Grupo ID:* ${groupId}${groupAdminsInfo}

💡 *Sistema de Admin (4 tipos):*
✅ Dono do número conectado ao bot
✅ Owner configurado em config.json  
✅ Admins configurados em config.json
✅ **NOVO: Admins do grupo atual**

💡 Para testar menção: \`!testmention @usuario\``

                await sock.sendMessage(groupId, {
                    text: debugInfo,
                    quoted: message
                })
            }

            // Comando para verificar se o bot é admin do grupo
            if (command === 'botadmin' || command === 'checkbot') {
                console.log('🧪 Verificando status do bot no grupo...')
                
                try {
                    const groupMetadata = await sock.groupMetadata(groupId)
                    const botRawId = sock.user.id
                    const botNumber = botRawId.split(':')[0]
                    const botJid = botNumber + '@s.whatsapp.net'
                    
                    const botParticipant = groupMetadata.participants.find(p => 
                        p.id === botJid || p.id.includes(botNumber)
                    )
                    
                    const groupAdmins = groupMetadata.participants
                        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                        .map(p => `• ${p.id.replace('@s.whatsapp.net', '')} (${p.admin})`)
                    
                    const botStatus = `🤖 *Status do Bot no Grupo*

🏠 **Grupo:** ${groupMetadata.subject}
🤖 **Bot número:** ${botNumber}
📍 **Bot no grupo:** ${botParticipant ? '✅ SIM' : '❌ NÃO'}
🛡️ **Bot é admin:** ${botParticipant?.admin ? `✅ ${botParticipant.admin.toUpperCase()}` : '❌ NÃO'}

👥 **Admins do grupo (${groupAdmins.length}):**
${groupAdmins.join('\n')}

💡 **Para promover o bot:**
1. Informações do grupo
2. Participantes  
3. Encontrar bot (${botNumber})
4. Tornar administrador`

                    await sock.sendMessage(groupId, {
                        text: botStatus,
                        quoted: message
                    })
                    
                } catch (error) {
                    await sock.sendMessage(groupId, {
                        text: `❌ Erro ao verificar status do bot: ${error.message}`,
                        quoted: message
                    })
                }
            }

            // Comando para testar detecção do dono (especial para debug)
            if (command === 'testowner') {
                console.log('🧪 === TESTE ESPECÍFICO DO DONO ===')
                console.log('📱 Mensagem fromMe:', message.key.fromMe)
                console.log('🔗 senderNumber calculado:', senderNumber)
                console.log('🤖 sock.user.id:', sock.user?.id)
                
                const isOwner = await isAdmin(senderNumber, sock, groupId)
                
                const testResult = `🧪 *Teste de Reconhecimento do Dono*

📱 *Mensagem própria?* ${message.key.fromMe ? '✅ SIM' : '❌ NÃO'}
🔢 *Seu número:* ${senderNumber.replace('@s.whatsapp.net', '')}
🤖 *Bot conectado:* ${sock.user?.id?.replace(':.*', '') || 'N/A'}
🔐 *Reconhecido como admin?* ${isOwner ? '✅ SIM' : '❌ NÃO'}

${isOwner ? 
    '🎉 *SUCESSO!* Você está sendo reconhecido como dono do bot!' : 
    '❌ *PROBLEMA!* Você NÃO está sendo reconhecido como dono.'
}

💡 Se não estiver funcionando, verifique os logs no terminal.`

                await sock.sendMessage(groupId, {
                    text: testResult,
                    quoted: message
                })
            }

            // Comando para testar extração de menção
            if (command === 'testmention' && (await isAdmin(senderNumber, sock, groupId))) {
                console.log('🧪 Testando extração de menção...')
                const mentionedNumber = getMentionedNumber(message)
                
                const testResult = `🧪 *Teste de Menção*

${mentionedNumber ? 
    `✅ Menção encontrada: ${mentionedNumber}` : 
    '❌ Nenhuma menção detectada'
}

📋 *Estrutura da mensagem:*
\`\`\`
${JSON.stringify(message.message, null, 2)}
\`\`\`

💡 Se não detectou a menção, tente:
1. Mencionar tocando no nome do usuário
2. Usar @ seguido do nome completo
3. Verificar se está realmente mencionando`

                await sock.sendMessage(groupId, {
                    text: testResult,
                    quoted: message
                })
            }
        } else {
            // Mensagem que não é comando ou não é em grupo
            console.log('🚫 === MENSAGEM NÃO PROCESSADA ===')
            console.log('   - É grupo?', isGroup)
            console.log('   - Começa com prefixo?', messageText.startsWith(config.prefix))
            console.log('   - Texto completo:', messageText.substring(0, 100))
            console.log('   - Remetente:', senderNumber)
            console.log('   - Group ID:', groupId)
            console.log('   - Prefixo configurado:', config.prefix)
            
            if (!isGroup) {
                console.log('   ❌ MOTIVO: Mensagem não é de grupo (apenas comandos em grupos são processados)')
            } else if (!messageText.startsWith(config.prefix)) {
                console.log('   ❌ MOTIVO: Mensagem não começa com prefixo')
            }
            console.log('=====================================')
        }
        
        // Atualizar status web após processar mensagem
        updateWebStatus(sock)
    })

    return sock
}

// Inicializar o bot
console.log('🚀 Iniciando Bot WhatsApp...')
startBot().catch((error) => {
    console.error('❌ Erro fatal:', error)
    process.exit(1)
})