# 📖 Exemplos de Uso do Bot

Este arquivo contém exemplos práticos de como usar o bot WhatsApp Moderador.

## 🔧 Configuração Inicial

### 1. Editando o arquivo config.json
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

**Importante:**
- Use números no formato internacional (código do país + DDD + número)
- Não use símbolos como +, -, (, ), espaços
- Exemplo brasileiro: 5511999999999 (55 = Brasil, 11 = São Paulo, 999999999 = número)

## 💬 Comandos no WhatsApp

### Comando para Remover Usuários (Somente Admins)

**Formato:** `!kick @usuario`

**Exemplos:**
```
!kick @usuario_indesejado
```
ou
```
!remover @spammer
```

**Resultado:**
```
✅ Usuário @usuario_indesejado foi removido do grupo pelos administradores.
```

### Comando de Ajuda

**Formato:** `!help` ou `!ajuda`

**Resultado:**
```
🤖 Comandos do Bot

Para Administradores:
• !kick @usuario - Remove um usuário do grupo
• !remover @usuario - Remove um usuário do grupo

Geral:
• !help - Mostra esta mensagem
• !regras - Exibe as regras do grupo

Funcionalidades Automáticas:
✅ Mensagem de boas-vindas para novos membros
✅ Sistema de moderação administrativo
```

### Exibir Regras do Grupo

**Formato:** `!regras`

**Resultado:** Mostra as regras completas do grupo.

## 🤖 Funcionalidades Automáticas

### 1. Mensagem de Boas-vindas
Automaticamente enviada quando alguém entra no grupo:

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

[11°] Envio de APKs permitidos apenas de sites confiáveis e sem anúncios. APKs puros são restritos a administradores, garantindo a segurança.

⚠️ Quebrar regras = banimento ⚠️
```

## 🚨 Cenários de Uso

### Cenário 1: Spam no Grupo
**Situação:** Usuário fazendo spam
**Ação do Admin:**
```
!kick @usuario_spam
```

### Cenário 2: Novo Membro
**Situação:** Pessoa entra no grupo
**Ação Automática:** Bot envia regras automaticamente

### Cenário 3: Mostrar Comandos
**Situação:** Alguém pergunta como usar o bot
**Ação de Qualquer Usuário:**
```
!help
```

### Cenário 4: Relembrar Regras
**Situação:** Precisar reforçar as regras
**Ação de Qualquer Usuário:**
```
!regras
```

## ⚠️ Erros Comuns e Soluções

### Erro: "Você não tem permissão para usar este comando"
**Causa:** Usuário não está na lista de admins
**Solução:** Adicionar número no config.json

### Erro: "Você precisa mencionar um usuário para remover"
**Causa:** Comando sem menção
**Solução:** Use `!kick @usuario` (com @)

### Erro: "Erro ao remover usuário. Verifique se o bot tem permissão de administrador"
**Causa:** Bot não é admin do grupo
**Solução:** Promover bot a administrador no grupo

### Bot não responde
**Causa:** Bot offline ou desconectado
**Solução:** Verificar se o bot está rodando no Termux

## 📱 Fluxo de Trabalho no Termux

### Iniciar o bot:
```bash
cd storage/shared/Bot-Whatsapp-
./start.sh
```

### Manter bot rodando em background:
```bash
screen -S bot-whatsapp
./start.sh
# Pressionar Ctrl+A, depois D para sair
```

### Voltar para ver o bot:
```bash
screen -r bot-whatsapp
```

### Parar o bot:
```bash
# Pressionar Ctrl+C no terminal onde o bot está rodando
```

## 🔄 Manutenção

### Atualizar o bot:
```bash
git pull
npm install
./start.sh
```

### Limpar autenticação (para reconectar):
```bash
rm -rf auth_info/
./start.sh
```

### Ver logs em tempo real:
O bot mostra todos os logs diretamente no terminal onde está rodando.

## 📞 Números de Exemplo (Brasil)

**São Paulo:** 5511999999999  
**Rio de Janeiro:** 5521999999999  
**Belo Horizonte:** 5531999999999  
**Salvador:** 5571999999999  
**Recife:** 5581999999999  

**Formato:** [Código País][DDD][Número]  
**Brasil:** 55[DDD][Número]