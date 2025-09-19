# 🤖 Bot WhatsApp Moderador

Bot completo para WhatsApp com funcionalidades de moderação e gerenciamento de grupos, otimizado para funcionar no Termux.

## ✨ Funcionalidades

- 🔐 **Autenticação Multi-device**: Conecta como dispositivo secundário
- 👥 **Gerenciamento de Grupos**: Remove usuários com comando simples
- 📜 **Mensagens Automáticas**: Envia regras para novos membros
- 👨‍💼 **Sistema de Admins**: Controle de permissões por número
- 📱 **Compatível com Termux**: Funciona perfeitamente no Android

## 👨‍💼 Sistema de Administradores

O bot reconhece administradores de **4 formas diferentes**:

### 1. 🤖 **Dono do Número Conectado** (Automático)
- A pessoa que escaneou o QR Code e conectou o bot
- **Automaticamente** tem todos os privilégios de administrador
- **Não precisa** estar configurado no `config.json`

### 2. 👥 **🆕 Admins do Grupo** (Automático)
- **QUALQUER ADMIN** do grupo WhatsApp onde o comando foi enviado
- **Detecção automática** - não precisa configurar nada
- Se você é admin do grupo, pode usar comandos administrativos
- **Dinâmico**: promoveu alguém a admin? Pode usar comandos imediatamente

### 3. 👑 **Owner Configurado**
- Número definido em `config.json` no campo `ownerNumber`
- Tem privilégios máximos de administrador

### 4. 📋 **Admins Configurados**
- Números definidos em `config.json` no array `admins`
- Podem usar todos os comandos administrativos

**Exemplo de prioridade:**
1. Dono do número conectado = Admin ✅
2. **Admin do grupo atual** = Admin ✅ 🆕
3. Owner configurado = Admin ✅  
4. Admins configurados = Admin ✅
5. Outros usuários = Sem privilégios ❌

## 📋 Comandos Disponíveis

### Para Administradores (qualquer admin do grupo + configurados):
- `!kick @usuario` - Remove um usuário do grupo
- `!remover @usuario` - Remove um usuário do grupo (comando alternativo)
- `!debug` - Mostra informações técnicas do bot (admin only)
- `!testmention @usuario` - Testa detecção de menções (admin only)

### Para Todos:
- `!help` ou `!ajuda` - Mostra lista de comandos
- `!regras` - Exibe as regras do grupo
- `!testowner` - Testa se é reconhecido como dono do bot
- `!botadmin` - Verifica se o bot é administrador do grupo

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
# Método 1: Diretório home (Recomendado - evita problemas de permissão)
cd ~
git clone https://github.com/deivid22srk/Bot-Whatsapp-.git
cd Bot-Whatsapp-

# Método 2: Storage compartilhado (pode ter problemas de permissão)
cd storage/shared
git clone https://github.com/deivid22srk/Bot-Whatsapp-.git
cd Bot-Whatsapp-
```

### 5. Instalar dependências do Node.js
```bash
# Instalação normal
npm install

# Se der erro de permissão no storage/shared:
npm config set bin-links false
npm install --no-bin-links

# Alternativa com yarn:
npm install -g yarn
yarn install
```

> 💡 **Dica**: Se tiver problemas de permissão, use o diretório home (`cd ~`) ao invés do storage compartilhado.

### 6. Configurar administradores (OPCIONAL)
```bash
# Editar o arquivo config.json com os números dos admins (OPCIONAL)
nano config.json
```

**⚡ NOVIDADE: Configuração opcional!**
- ✅ **Admins do grupo são detectados automaticamente**
- ✅ **Dono do número conectado é admin automaticamente**
- ✅ **Configuração só necessária para admins extras**

**Exemplo de configuração (opcional):**
```json
{
  "ownerNumber": "5511999999999",
  "admins": [
    "5511999999999",
    "5511888888888"
  ]
}
```

> ⚠️ **Importante**: Use números no formato internacional sem símbolos (ex: 5511999999999)

> 💡 **Dica**: O bot funciona perfeitamente sem configurar nada! Admins do grupo e dono do número conectado são reconhecidos automaticamente.

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
2. **IMPORTANTE: Conceda permissões de Administrador para o bot**
3. O bot começará a funcionar automaticamente

### 🔧 Como Promover o Bot a Administrador:
1. Abra o WhatsApp e vá ao grupo
2. Toque em "Informações do grupo" (3 pontinhos → Informações do grupo)
3. Toque em "Participantes" 
4. Encontre o bot na lista de participantes
5. Toque no nome do bot
6. Selecione "Tornar administrador do grupo"
7. Confirme a ação

### 🧪 Verificar se o Bot é Admin:
```
!botadmin
```
Este comando mostra se o bot tem permissões de administrador.

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

### Erro de instalação (EACCES: permission denied):
```bash
# Solução 1: Instalar no diretório home
cd ~
rm -rf Bot-Whatsapp-
git clone https://github.com/deivid22srk/Bot-Whatsapp-.git
cd Bot-Whatsapp-
npm install

# Solução 2: Configurar npm
npm config set bin-links false
npm install --no-bin-links

# Solução 3: Usar yarn
npm install -g yarn
yarn install
```

### Comando !kick não funciona:
```bash
# 1. Verificar se você é admin
!debug

# 2. Testar detecção de menção
!testmention @usuario

# 3. Verificar configuração
nano config.json
```

**Checklist para !kick:**
- [ ] Seu número está em `config.json`?
- [ ] Bot é administrador do grupo?
- [ ] Está mencionando o usuário corretamente?
- [ ] Usuario mencionado não é admin?

### Bot não conecta:
- Verifique sua conexão com a internet
- Tente deletar a pasta `auth_info` e reconectar
- Certifique-se de que o Termux tem permissão de rede

### Comandos não funcionam:
- Use `!debug` para verificar informações técnicas
- Confirme se seu número está na lista de admins no `config.json`
- Use o formato correto: `!kick @usuario` (mencionando o usuário)
- Verifique os logs no terminal do Termux

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