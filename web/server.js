const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

// Configurações
const app = express()
const PORT = 3000

// Middlewares
app.use(cors())
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'public')))

// Arquivos de configuração
const CONFIG_FILE = path.join(__dirname, '../web-config.json')
const BOT_CONFIG_FILE = path.join(__dirname, '../config.json')

// Estado do bot
let botStatus = {
    connected: false,
    groups: [],
    lastUpdate: new Date(),
    totalMessages: 0,
    activeGroups: 0
}

// WebSocket Server para comunicação em tempo real
const wss = new WebSocket.Server({ port: 3001 })

// Função para carregar configuração web
function loadWebConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
        }
    } catch (error) {
        console.error('Erro ao carregar configuração web:', error)
    }
    
    // Configuração padrão
    const defaultConfig = {
        activeGroups: {},
        customCommands: [],
        settings: {
            autoWelcome: true,
            antiSpam: false,
            logActions: true
        }
    }
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2))
    return defaultConfig
}

// Função para salvar configuração web
function saveWebConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
        broadcast({ type: 'config_updated', data: config })
        return true
    } catch (error) {
        console.error('Erro ao salvar configuração web:', error)
        return false
    }
}

// Função para broadcast via WebSocket
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message))
        }
    })
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('🌐 Nova conexão WebSocket estabelecida')
    
    // Enviar estado atual
    ws.send(JSON.stringify({
        type: 'bot_status',
        data: botStatus
    }))
    
    ws.on('close', () => {
        console.log('🌐 Conexão WebSocket fechada')
    })
})

// API Routes

// 1. Status do bot
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: botStatus
    })
})

// 2. Listar grupos
app.get('/api/groups', (req, res) => {
    try {
        const webConfig = loadWebConfig()
        res.json({
            success: true,
            data: {
                groups: botStatus.groups,
                activeGroups: webConfig.activeGroups
            }
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// 3. Atualizar status de grupo (ativo/inativo)
app.post('/api/groups/:groupId/toggle', (req, res) => {
    try {
        const { groupId } = req.params
        const { active } = req.body
        
        const webConfig = loadWebConfig()
        webConfig.activeGroups[groupId] = active
        
        if (saveWebConfig(webConfig)) {
            res.json({
                success: true,
                message: `Grupo ${active ? 'ativado' : 'desativado'} com sucesso`
            })
        } else {
            throw new Error('Erro ao salvar configuração')
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// 4. Listar comandos customizados
app.get('/api/commands', (req, res) => {
    try {
        const webConfig = loadWebConfig()
        res.json({
            success: true,
            data: webConfig.customCommands
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// 5. Adicionar comando customizado
app.post('/api/commands', (req, res) => {
    try {
        const { command, response, adminOnly, description } = req.body
        
        if (!command || !response) {
            return res.status(400).json({
                success: false,
                error: 'Comando e resposta são obrigatórios'
            })
        }
        
        const webConfig = loadWebConfig()
        
        // Verificar se comando já existe
        const existingCommand = webConfig.customCommands.find(c => c.command === command)
        if (existingCommand) {
            return res.status(400).json({
                success: false,
                error: 'Comando já existe'
            })
        }
        
        // Adicionar novo comando
        const newCommand = {
            id: Date.now().toString(),
            command: command.toLowerCase(),
            response,
            adminOnly: adminOnly || false,
            description: description || '',
            createdAt: new Date().toISOString(),
            usage: 0
        }
        
        webConfig.customCommands.push(newCommand)
        
        if (saveWebConfig(webConfig)) {
            res.json({
                success: true,
                message: 'Comando adicionado com sucesso',
                data: newCommand
            })
        } else {
            throw new Error('Erro ao salvar comando')
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// 6. Editar comando customizado
app.put('/api/commands/:id', (req, res) => {
    try {
        const { id } = req.params
        const { command, response, adminOnly, description } = req.body
        
        const webConfig = loadWebConfig()
        const commandIndex = webConfig.customCommands.findIndex(c => c.id === id)
        
        if (commandIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Comando não encontrado'
            })
        }
        
        // Atualizar comando
        webConfig.customCommands[commandIndex] = {
            ...webConfig.customCommands[commandIndex],
            command: command?.toLowerCase() || webConfig.customCommands[commandIndex].command,
            response: response || webConfig.customCommands[commandIndex].response,
            adminOnly: adminOnly !== undefined ? adminOnly : webConfig.customCommands[commandIndex].adminOnly,
            description: description !== undefined ? description : webConfig.customCommands[commandIndex].description,
            updatedAt: new Date().toISOString()
        }
        
        if (saveWebConfig(webConfig)) {
            res.json({
                success: true,
                message: 'Comando atualizado com sucesso',
                data: webConfig.customCommands[commandIndex]
            })
        } else {
            throw new Error('Erro ao salvar comando')
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// 7. Deletar comando customizado
app.delete('/api/commands/:id', (req, res) => {
    try {
        const { id } = req.params
        
        const webConfig = loadWebConfig()
        const commandIndex = webConfig.customCommands.findIndex(c => c.id === id)
        
        if (commandIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Comando não encontrado'
            })
        }
        
        webConfig.customCommands.splice(commandIndex, 1)
        
        if (saveWebConfig(webConfig)) {
            res.json({
                success: true,
                message: 'Comando deletado com sucesso'
            })
        } else {
            throw new Error('Erro ao deletar comando')
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// 8. Atualizar configurações gerais
app.post('/api/settings', (req, res) => {
    try {
        const webConfig = loadWebConfig()
        webConfig.settings = { ...webConfig.settings, ...req.body }
        
        if (saveWebConfig(webConfig)) {
            res.json({
                success: true,
                message: 'Configurações atualizadas com sucesso'
            })
        } else {
            throw new Error('Erro ao salvar configurações')
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// 9. Obter configurações gerais
app.get('/api/settings', (req, res) => {
    try {
        const webConfig = loadWebConfig()
        res.json({
            success: true,
            data: webConfig.settings
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// Função para ser chamada pelo bot principal
function updateBotStatus(status) {
    botStatus = { ...botStatus, ...status, lastUpdate: new Date() }
    broadcast({ type: 'bot_status', data: botStatus })
}

// Função para obter configuração web (para uso do bot)
function getWebConfig() {
    return loadWebConfig()
}

// Rota principal - Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Painel Web do Bot iniciado!`)
    console.log(`📱 Acesse de qualquer dispositivo na rede local:`)
    console.log(`   http://192.168.x.x:${PORT}`)
    console.log(`   http://localhost:${PORT}`)
    console.log(`🔄 WebSocket rodando na porta 3001`)
})

// Exportar funções para uso do bot
module.exports = {
    updateBotStatus,
    getWebConfig
}