#!/bin/bash

echo "🤖 ========== Bot WhatsApp + Painel Web =========="
echo ""
echo "🚀 Iniciando Bot WhatsApp Moderador..."
echo "🌐 Iniciando Painel Web..."
echo ""
echo "📱 Bot WhatsApp: Terminal atual"
echo "🌐 Painel Web: http://localhost:3000"
echo "📡 Rede local: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "💡 Dica: Ctrl+C para parar ambos os serviços"
echo "================================================"

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

# Verificar se o arquivo de configuração existe
if [ ! -f "config.json" ]; then
    echo "⚠️ Arquivo config.json não encontrado!"
    echo "📝 Usando configuração padrão (pode configurar admins depois via painel web)"
    echo ""
fi

# Iniciar bot e painel web simultaneamente
npx concurrently --kill-others --prefix-colors "cyan,magenta" --prefix "[{name}]" --names "BOT,WEB" "node index.js" "node web/server.js"