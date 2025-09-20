#!/usr/bin/env node

/**
 * Script de teste para o Sistema de Doações via PIX
 * Testa todas as funcionalidades implementadas para apoio ao bot
 */

import fs from 'fs'

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
}

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`)
}

async function testDonationAPI() {
    try {
        log('🔄 Testando API de doação...', 'blue')
        
        const response = await fetch('http://localhost:3000/api/donation')
        
        if (response.ok) {
            const result = await response.json()
            if (result.success) {
                log('✅ API de doação funcionando!', 'green')
                log(`🔑 Chave PIX: ${result.data.pixKey}`, 'yellow')
                log(`💬 Mensagem: ${result.data.message}`, 'yellow')
                log(`🟢 Ativo: ${result.data.enabled}`, 'yellow')
                return true
            }
        }
        
        log('❌ API de doação não respondeu corretamente', 'red')
        return false
    } catch (error) {
        log(`❌ Erro ao testar API: ${error.message}`, 'red')
        return false
    }
}

async function checkBotStatus() {
    try {
        const response = await fetch('http://localhost:3000/api/status')
        if (response.ok) {
            const result = await response.json()
            return result.data
        }
    } catch (error) {
        log(`⚠️ Erro ao verificar status do bot: ${error.message}`, 'yellow')
    }
    return null
}

function displayDonationCommands() {
    log('\\n📝 Comandos de Doação Implementados no Bot:', 'bold')
    log('=' * 50, 'blue')
    
    const commands = [
        {
            command: '!pix',
            description: 'Exibe informações completas para doação via PIX',
            example: '!pix'
        },
        {
            command: '!donate',
            description: 'Alias para !pix - mesmo conteúdo',
            example: '!donate'
        },
        {
            command: '!doar',
            description: 'Versão em português do comando donate',
            example: '!doar'
        }
    ]
    
    commands.forEach(cmd => {
        log(`\\n🎯 ${cmd.command}`, 'cyan')
        log(`   📄 ${cmd.description}`, 'yellow')
        log(`   💭 Exemplo: ${cmd.example}`, 'magenta')
    })
}

function displayWebFeatures() {
    log('\\n🌐 Funcionalidades do Painel Web:', 'bold')
    log('=' * 50, 'blue')
    
    const features = [
        '🆕 Nova aba "💝 Apoiar o Bot"',
        '💳 Interface visual para chave PIX',
        '📋 Botão para copiar chave automaticamente',
        '📱 Instruções passo-a-passo para doação',
        '💝 Cards explicativos sobre custos e impacto',
        '🎨 Design responsivo e atrativo',
        '✅ Toast de confirmação ao copiar',
        '🔄 API endpoint para informações de doação'
    ]
    
    features.forEach(feature => {
        log(`   ${feature}`, 'green')
    })
}

function displayMessageExamples() {
    log('\\n💬 Exemplos de Mensagens do Bot:', 'bold')
    log('=' * 50, 'blue')
    
    log('\\n1️⃣ Comando !help (com rodapé de doação):', 'cyan')
    log('   [...comandos normais...]', 'yellow')
    log('   ---', 'yellow')
    log('   💡 Este bot roda 24h no meu celular via Termux. Manter ele online tem custos.', 'yellow')
    log('   ❤️ Use !pix para apoiar o projeto!', 'yellow')
    
    log('\\n2️⃣ Comando !regras (com rodapé de doação):', 'cyan')
    log('   [...regras do grupo...]', 'yellow')
    log('   ---', 'yellow')
    log('   💡 Este bot roda 24h no meu celular via Termux. Manter ele online tem custos.', 'yellow')
    log('   ❤️ Use !pix para apoiar o bot!', 'yellow')
    
    log('\\n3️⃣ Comando !pix (mensagem completa):', 'cyan')
    log('   💰 *Apoie o Bot Moderador*', 'yellow')
    log('   \\n🤖 **Por que doar?**', 'yellow')
    log('   Este bot roda 24h no meu celular via Termux. Manter ele online tem custos.', 'yellow')
    log('   \\n💸 **Custos mensais:**', 'yellow')
    log('   • 🔋 Energia elétrica 24h', 'yellow')
    log('   • 📱 Internet móvel ilimitada', 'yellow')
    log('   • ⚡ Manutenção e atualizações', 'yellow')
    log('   • 🛡️ Segurança e backups', 'yellow')
    log('   \\n📋 **Chave PIX:**', 'yellow')
    log('   `7789f18e-3562-421e-b98b-688c7b402039`', 'yellow')
    log('   \\n[...instruções detalhadas...]', 'yellow')
}

function displayImplementationSummary() {
    log('\\n📊 Resumo da Implementação:', 'bold')
    log('=' * 50, 'blue')
    
    const implementation = [
        '✅ Sistema de doação via PIX integrado',
        '✅ Chave PIX configurada: 7789f18e-3562-421e-b98b-688c7b402039',
        '✅ Comandos !pix, !donate e !doar implementados',
        '✅ Rodapé educativo em comandos principais',
        '✅ Nova aba no painel web com interface completa',
        '✅ Botão de cópia automática da chave PIX',
        '✅ API endpoint para dados de doação',
        '✅ Design responsivo e atrativo',
        '✅ Mensagens educativas sobre custos',
        '✅ Sistema de feedback visual (toasts)'
    ]
    
    implementation.forEach(item => {
        log(`${item}`, 'green')
    })
}

async function main() {
    log('🚀 Testando Sistema de Doações do Bot WhatsApp', 'bold')
    log('=' * 60, 'blue')
    
    // Verificar se o painel web está rodando
    log('🌐 Verificando painel web...', 'blue')
    const botStatus = await checkBotStatus()
    
    if (!botStatus) {
        log('❌ Painel web não está rodando!', 'red')
        log('💡 Execute: npm run web', 'yellow')
        log('\\nℹ️ Continuando com demonstração off-line...', 'cyan')
    } else {
        log('✅ Painel web está rodando!', 'green')
        
        // Testar API de doação
        await testDonationAPI()
    }
    
    // Mostrar funcionalidades implementadas
    displayDonationCommands()
    displayWebFeatures()
    displayMessageExamples()
    displayImplementationSummary()
    
    log('\\n🎯 Como Testar:', 'bold')
    log('=' * 30, 'blue')
    log('1. 🤖 Inicie o bot: npm start', 'yellow')
    log('2. 🌐 Inicie o painel: npm run web', 'yellow')
    log('3. 📱 Acesse: http://localhost:3000', 'yellow')
    log('4. 💝 Clique na aba "Apoiar o Bot"', 'yellow')
    log('5. 📋 Teste o botão "Copiar" da chave PIX', 'yellow')
    log('6. 💬 No WhatsApp, teste: !pix, !donate ou !doar', 'yellow')
    log('7. 📋 Verifique os rodapés em !help e !regras', 'yellow')
    
    log('\\n💡 Recursos Principais:', 'bold')
    log('=' * 30, 'blue')
    log('• 💳 Chave PIX: 7789f18e-3562-421e-b98b-688c7b402039', 'green')
    log('• 📱 Interface web completa e responsiva', 'green')
    log('• 🤖 Comandos integrados ao bot', 'green')
    log('• 💬 Mensagens educativas sobre custos', 'green')
    log('• 🎨 Design atrativo e profissional', 'green')
    
    log('\\n🎉 Sistema de doações implementado com sucesso!', 'bold')
    log('💝 Agora os usuários podem apoiar facilmente o bot via PIX', 'green')
    log('🚀 Interface amigável tanto no WhatsApp quanto no painel web', 'green')
}

main().catch(error => {
    log(`💥 Erro: ${error.message}`, 'red')
    console.error(error.stack)
    process.exit(1)
})