#!/bin/bash

echo "🤖 Iniciando Bot WhatsApp Moderador..."
echo "==============================================="

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale com: pkg install nodejs"
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Verificar se o arquivo de configuração existe
if [ ! -f "config.json" ]; then
    echo "⚠️ Arquivo config.json não encontrado!"
    echo "📝 Edite o arquivo config.json com os números dos administradores antes de continuar."
    exit 1
fi

echo "✅ Tudo pronto! Iniciando o bot..."
echo "📱 Escaneie o QR Code com seu WhatsApp quando aparecer."
echo ""

# Iniciar o bot
node index.js