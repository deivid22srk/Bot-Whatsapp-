import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import path from 'path'

// Configurações do bot
const config = {
    botName: '🤖 Bot Moderador',
    ownerNumber: '', // Número do dono do bot (formato: 5511999999999)
    admins: [], // Números dos admins (será carregado do config.json)
    prefix: '!',
    autoWelcome: true
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
function isAdmin(userNumber) {
    const cleanNumber = userNumber.replace('@s.whatsapp.net', '')
    console.log('🔍 Verificando admin:', cleanNumber)
    console.log('📋 Admins configurados:', config.admins)
    console.log('👑 Owner:', config.ownerNumber)
    const isAdminUser = config.admins.includes(cleanNumber) || cleanNumber === config.ownerNumber
    console.log('✅ É admin?', isAdminUser)
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
    // Carregar configurações
    loadConfig()

    // Estado de autenticação
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
    
    // Criar socket do WhatsApp
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Bot Moderador', 'Desktop', '1.0.0']
    })

    // Salvar credenciais quando atualizadas
    sock.ev.on('creds.update', saveCreds)

    // Gerenciar conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            console.log('📱 Escaneie o QR Code acima com seu WhatsApp!')
            qrcode.generate(qr, { small: true })
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error && new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut)
            console.log('❌ Conexão fechada devido a:', lastDisconnect?.error, ', reconectando:', shouldReconnect)
            if (shouldReconnect) {
                startBot()
            }
        } else if (connection === 'open') {
            console.log('✅ Bot conectado ao WhatsApp!')
            console.log('🤖 Bot está ativo e monitorando mensagens...')
        }
    })

    // Gerenciar atualizações de grupos (novos membros)
    sock.ev.on('group-participants.update', async (update) => {
        if (!config.autoWelcome) return

        const { id: groupId, participants, action } = update
        
        if (action === 'add') {
            // Aguardar um pouco antes de enviar a mensagem
            setTimeout(async () => {
                try {
                    await sock.sendMessage(groupId, {
                        text: WELCOME_MESSAGE
                    })
                    console.log('📨 Mensagem de boas-vindas enviada para o grupo:', groupId)
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem de boas-vindas:', error)
                }
            }, 2000)
        }
    })

    // Gerenciar mensagens recebidas
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0]
        if (!message.message) return
        if (message.key.fromMe) return // Ignorar mensagens próprias

        const messageText = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || ''
        
        const isGroup = message.key.remoteJid?.endsWith('@g.us')
        const senderNumber = message.key.participant || message.key.remoteJid
        const groupId = message.key.remoteJid

        console.log('📩 Mensagem recebida:', messageText.substring(0, 50) + '...')

        // Processar comandos apenas em grupos
        if (isGroup && messageText.startsWith(config.prefix)) {
            const args = messageText.slice(config.prefix.length).trim().split(' ')
            const command = args[0].toLowerCase()

            // Comando para remover usuário (!kick @usuario)
            if (command === 'kick' || command === 'remover' || command === 'remove') {
                console.log('🔨 Comando kick executado por:', senderNumber)
                
                // Verificar se o remetente é admin
                if (!isAdmin(senderNumber)) {
                    console.log('❌ Usuário não é admin')
                    await sock.sendMessage(groupId, {
                        text: '❌ Você não tem permissão para usar este comando.',
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
                    const botNumber = sock.user.id.replace(':.*', '').replace('@s.whatsapp.net', '')
                    const botParticipant = groupMetadata.participants.find(p => p.id.includes(botNumber))
                    
                    console.log('🤖 Bot número:', botNumber)
                    console.log('👥 Participante do bot:', botParticipant?.admin)
                    
                    if (!botParticipant || !botParticipant.admin) {
                        await sock.sendMessage(groupId, {
                            text: '❌ Erro: O bot precisa ser administrador do grupo para remover usuários.\n\n👨‍💼 Por favor, promova o bot a administrador.',
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
                const isUserAdmin = isAdmin(senderNumber)
                let helpText = `🤖 *Comandos do Bot*

*Para Administradores:*
• \`${config.prefix}kick @usuario\` - Remove um usuário do grupo
• \`${config.prefix}remover @usuario\` - Remove um usuário do grupo`

                if (isUserAdmin) {
                    helpText += `
• \`${config.prefix}debug\` - Informações técnicas do bot
• \`${config.prefix}testmention @usuario\` - Testar detecção de menções`
                }

                helpText += `

*Geral:*
• \`${config.prefix}help\` - Mostra esta mensagem
• \`${config.prefix}regras\` - Exibe as regras do grupo

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
                await sock.sendMessage(groupId, {
                    text: WELCOME_MESSAGE,
                    quoted: message
                })
            }

            // Comando de debug (apenas para admins)
            if (command === 'debug' && isAdmin(senderNumber)) {
                const debugInfo = `🔧 *Informações de Debug*

📱 *Seu número:* ${senderNumber.replace('@s.whatsapp.net', '')}
👥 *Admins configurados:* ${config.admins.join(', ')}
🤖 *Bot número:* ${sock.user.id.replace(':.*', '')}
📍 *Grupo ID:* ${groupId}
🔧 *Versão Baileys:* ${JSON.stringify(message.key)}

💡 Para testar menção, use: \`!testmention @usuario\``

                await sock.sendMessage(groupId, {
                    text: debugInfo,
                    quoted: message
                })
            }

            // Comando para testar extração de menção
            if (command === 'testmention' && isAdmin(senderNumber)) {
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
        }
    })

    return sock
}

// Inicializar o bot
console.log('🚀 Iniciando Bot WhatsApp...')
startBot().catch((error) => {
    console.error('❌ Erro fatal:', error)
    process.exit(1)
})