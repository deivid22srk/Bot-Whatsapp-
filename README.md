# 🤖 Bot WhatsApp Moderador

Bot completo para WhatsApp com funcionalidades de moderação e gerenciamento de grupos, otimizado para funcionar no Termux.

## ✨ Funcionalidades

- 🔐 **Autenticação Multi-device**: Conecta como dispositivo secundário
- 👥 **Gerenciamento de Grupos**: Remove usuários com comando simples
- 📜 **Mensagens Automáticas**: Envia regras para novos membros
- 👨‍💼 **Sistema de Admins**: Controle de permissões por número
- 📱 **Compatível com Termux**: Funciona perfeitamente no Android

## 📋 Comandos Disponíveis

### Para Administradores:
- `!kick @usuario` - Remove um usuário do grupo
- `!remover @usuario` - Remove um usuário do grupo (comando alternativo)

### Para Todos:
- `!help` ou `!ajuda` - Mostra lista de comandos
- `!regras` - Exibe as regras do grupo

## 🚀 Instalação no Termux

### 1. Instalar o Termux
```bash
# Baixe o Termux da F-Droid ou GitHub (NÃO da Play Store)
```

### 2. Atualizar pacotes do Termux
```bash
pkg update && pkg upgrade -y
```

### 3. Instalar dependências necessárias
```bash
# Instalar Node.js
pkg install nodejs -y

# Instalar Git
pkg install git -y

# Instalar Python (pode ser necessário para algumas dependências)
pkg install python -y

# Permitir acesso ao armazenamento
termux-setup-storage
```

### 4. Clonar o repositório
```bash
cd storage/shared
git clone https://github.com/deivid22srk/Bot-Whatsapp-.git
cd Bot-Whatsapp-
```

### 5. Instalar dependências do Node.js
```bash
npm install
```

### 6. Configurar administradores
```bash
# Editar o arquivo config.json com os números dos admins
nano config.json
```

**Exemplo de configuração:**
```json
{
  "ownerNumber": "5511999999999",
  "admins": [
    "5511999999999",
    "5511888888888",
    "5511777777777"
  ]
}
```

> ⚠️ **Importante**: Use números no formato internacional sem símbolos (ex: 5511999999999)

### 7. Iniciar o bot
```bash
npm start
```

### 8. Conectar ao WhatsApp
1. Um QR Code aparecerá no terminal
2. Abra o WhatsApp no seu celular
3. Vá em **Configurações** → **Aparelhos conectados** → **Conectar um aparelho**
4. Escaneie o QR Code que aparece no Termux
5. O bot será conectado como um dispositivo secundário

## 📱 Uso no Grupo

### Adicionando o Bot ao Grupo
1. Adicione o número conectado ao bot no grupo
2. Conceda permissões de **Administrador** para o bot
3. O bot começará a funcionar automaticamente

### Removendo Usuários
```
!kick @usuario
```
Apenas administradores configurados podem usar este comando.

### Mensagem Automática
Toda vez que alguém entrar no grupo, o bot enviará automaticamente as regras:

```
🔴 Regras do Grupo 🔴

[1°] Respeito sempre – sem insultos, preconceitos ou ofensas.
[2°] Proibido spam – nada de flood, links irrelevantes ou propaganda sem permissão.
[3°] Foque no tema do grupo.
[4°] Sem conteúdo impróprio (pornografia, violência extrema, ilegal).
[5°] Discussões construtivas sim, brigas não.
[6°] Evite fake news – confirme antes de compartilhar.
[7°] Respeite os admins e suas decisões.
[8°] Idade mínima: 15+.
[9°] Proibida venda, serviços ou jogos de azar.
[10°] O contato com os administradores deve ser feito exclusivamente no grupo
(não pode ir no privado).
[11°] Envio de APKs permitidos apenas de sites confiáveis e sem anúncios. 
APKs puros são restritos a administradores, garantindo a segurança.

⚠️ Quebrar regras = banimento ⚠️
```

## 🔧 Comandos Úteis do Termux

### Manter o bot rodando em segundo plano:
```bash
# Instalar screen para sessões persistentes
pkg install screen

# Criar uma sessão para o bot
screen -S whatsapp-bot

# Iniciar o bot na sessão
npm start

# Sair da sessão (bot continua rodando)
# Pressione: Ctrl + A, depois D

# Voltar para a sessão do bot
screen -r whatsapp-bot

# Listar todas as sessões
screen -ls
```

### Atualizar o bot:
```bash
git pull origin main
npm install
```

### Ver logs do bot:
```bash
# O bot mostra logs em tempo real no terminal
# Para parar, pressione Ctrl + C
```

## ⚡ Comandos de Desenvolvimento

### Executar em modo desenvolvimento (reinicia automaticamente):
```bash
npm run dev
```

### Limpar dados de autenticação (para reconectar):
```bash
rm -rf auth_info/
```

## 🛠️ Solução de Problemas

### Bot não conecta:
- Verifique sua conexão com a internet
- Tente deletar a pasta `auth_info` e reconectar
- Certifique-se de que o Termux tem permissão de rede

### Comandos não funcionam:
- Verifique se o bot tem permissões de administrador no grupo
- Confirme se seu número está na lista de admins no `config.json`
- Use o formato correto: `!kick @usuario` (mencionando o usuário)

### Bot para de funcionar:
- Use `screen` para manter sessões persistentes
- Verifique os logs para identificar erros
- Reinicie o bot se necessário

### Erros de instalação no Termux:
```bash
# Limpar cache do npm
npm cache clean --force

# Reinstalar dependências
rm -rf node_modules
npm install
```

## 📁 Estrutura do Projeto

```
Bot-Whatsapp-/
├── index.js           # Arquivo principal do bot
├── package.json       # Dependências e scripts
├── config.json       # Configuração de administradores
├── .gitignore        # Arquivos ignorados pelo Git
├── README.md         # Este arquivo
└── auth_info/        # Dados de autenticação (gerado automaticamente)
```

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature: `git checkout -b minha-feature`
3. Commit suas mudanças: `git commit -m 'Adiciona minha feature'`
4. Push para a branch: `git push origin minha-feature`
5. Abra um Pull Request

## ⚠️ Avisos Importantes

- **Use por sua conta e risco**: O WhatsApp pode banir contas que violem os termos de serviço
- **Mantenha o bot atualizado**: Atualizações regulares são importantes para compatibilidade
- **Backup da autenticação**: Faça backup da pasta `auth_info` se necessário
- **Números de telefone**: Use sempre formato internacional sem símbolos

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## 🆘 Suporte

Se você encontrar problemas:
1. Verifique a seção de solução de problemas acima
2. Confira se seguiu todos os passos de instalação
3. Abra uma issue no GitHub com detalhes do erro

---

**Desenvolvido por [deivid22srk](https://github.com/deivid22srk)**