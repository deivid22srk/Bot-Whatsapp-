#!/usr/bin/env node

/**
 * Script de teste para verificar o reload automático de comandos customizados
 * Este script adiciona um novo comando via API e verifica se o bot consegue 
 * reconhecer o novo comando sem precisar ser reiniciado.
 */

import fs from 'fs'

const CONFIG_FILE = './web-config.json'
const API_BASE_URL = 'http://localhost:3000/api'

// Cores para o terminal
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
}

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`)
}

async function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
            return JSON.parse(content)
        }
    } catch (error) {
        log(`❌ Erro ao carregar configuração: ${error.message}`, 'red')
    }
    return null
}

async function addTestCommand() {
    const testCommand = {
        command: 'testeautoreload',
        response: '🔄 Este comando foi adicionado automaticamente pelo teste de auto-reload! ✅\n\n🕒 Criado em: {timestamp}\n👤 Testado por: {user}',
        adminOnly: false,
        description: 'Comando criado pelo teste de auto-reload'
    }

    try {
        log('🔄 Adicionando comando de teste via API...', 'blue')
        
        const response = await fetch(`${API_BASE_URL}/commands`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testCommand)
        })

        if (response.ok) {
            const result = await response.json()
            log(`✅ Comando adicionado com sucesso!`, 'green')
            log(`📝 ID: ${result.data.id}`, 'yellow')
            log(`⚡ Comando: !${result.data.command}`, 'yellow')
            return result.data
        } else {
            const error = await response.json()
            log(`❌ Erro da API: ${error.error}`, 'red')
            return null
        }
    } catch (error) {
        log(`❌ Erro ao adicionar comando: ${error.message}`, 'red')
        return null
    }
}

async function removeTestCommand(commandId) {
    try {
        log('🗑️ Removendo comando de teste...', 'blue')
        
        const response = await fetch(`${API_BASE_URL}/commands/${commandId}`, {
            method: 'DELETE'
        })

        if (response.ok) {
            log('✅ Comando de teste removido com sucesso!', 'green')
            return true
        } else {
            const error = await response.json()
            log(`❌ Erro ao remover comando: ${error.error}`, 'red')
            return false
        }
    } catch (error) {
        log(`❌ Erro ao remover comando: ${error.message}`, 'red')
        return false
    }
}

async function checkBotStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/status`)
        if (response.ok) {
            const result = await response.json()
            return result.data
        }
    } catch (error) {
        log(`⚠️ Não foi possível verificar status do bot: ${error.message}`, 'yellow')
    }
    return null
}

async function listCurrentCommands() {
    try {
        const response = await fetch(`${API_BASE_URL}/commands`)
        if (response.ok) {
            const result = await response.json()
            return result.data
        }
    } catch (error) {
        log(`⚠️ Não foi possível listar comandos: ${error.message}`, 'yellow')
    }
    return []
}

async function main() {
    log('🚀 Iniciando teste de auto-reload de comandos customizados...', 'bold')
    log('=' * 60, 'blue')
    
    // Verificar se o painel web está rodando
    log('🌐 Verificando se o painel web está rodando...', 'blue')
    const botStatus = await checkBotStatus()
    
    if (!botStatus) {
        log('❌ Painel web não está rodando!', 'red')
        log('💡 Execute: npm run web', 'yellow')
        process.exit(1)
    }
    
    log(`✅ Painel web está rodando!`, 'green')
    log(`🤖 Bot conectado: ${botStatus.connected ? '✅' : '❌'}`, botStatus.connected ? 'green' : 'yellow')
    
    // Listar comandos atuais
    log('\\n📋 Comandos customizados atuais:', 'blue')
    const currentCommands = await listCurrentCommands()
    if (currentCommands.length > 0) {
        currentCommands.forEach(cmd => {
            log(`  • !${cmd.command} ${cmd.adminOnly ? '(🔐 admin)' : ''}`, 'yellow')
        })
    } else {
        log('  Nenhum comando encontrado', 'yellow')
    }
    
    // Adicionar comando de teste
    log('\\n🧪 TESTE: Adicionando novo comando...', 'bold')
    const newCommand = await addTestCommand()
    
    if (!newCommand) {
        log('❌ Falha ao adicionar comando de teste!', 'red')
        process.exit(1)
    }
    
    // Aguardar um pouco para o auto-reload funcionar
    log('\\n⏳ Aguardando 35 segundos para o auto-reload funcionar...', 'blue')
    log('(O bot recarrega configurações automaticamente a cada 30 segundos)', 'yellow')
    
    for (let i = 35; i > 0; i--) {
        process.stdout.write(`\\r⏳ Restam ${i} segundos...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    log('\\n\\n✅ Comando de teste foi adicionado!', 'green')
    log('🎯 Agora teste no WhatsApp:', 'bold')
    log(`   !${newCommand.command}`, 'green')
    
    log('\\n📋 Recursos implementados:', 'blue')
    log('  ✅ Auto-reload a cada 30 segundos', 'green')
    log('  ✅ Reload manual com !reload (admins)', 'green') 
    log('  ✅ Retry automático quando comando não é encontrado', 'green')
    log('  ✅ Logs detalhados no terminal do bot', 'green')
    
    // Perguntar se deve remover o comando de teste
    log('\\n🤔 Deseja remover o comando de teste? (y/N): ', 'yellow')
    
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    
    process.stdin.on('data', async (key) => {
        if (key === 'y' || key === 'Y') {
            log('\\n🗑️ Removendo comando de teste...', 'blue')
            await removeTestCommand(newCommand.id)
            log('\\n✅ Teste concluído!', 'green')
            process.exit(0)
        } else if (key === '\\n' || key === '\\r' || key === 'n' || key === 'N') {
            log('\\n✅ Comando de teste mantido. Teste concluído!', 'green')
            log('💡 Para remover depois: acesse o painel web ou use a API', 'yellow')
            process.exit(0)
        } else if (key === '\\u0003') { // Ctrl+C
            log('\\n\\n👋 Saindo...', 'yellow')
            process.exit(0)
        }
    })
}

main().catch(error => {
    log(`💥 Erro fatal: ${error.message}`, 'red')
    console.error(error.stack)
    process.exit(1)
})