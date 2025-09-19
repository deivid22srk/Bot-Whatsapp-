# 🔧 Guia de Solução de Problemas

## ❌ Problema: Comando !kick não remove usuário

### 🔍 **Possíveis Causas e Soluções**

#### 1. **Seu número não está configurado como admin**
```bash
# Abrir arquivo de configuração
nano config.json
```

**Verificar se seu número está na lista:**
```json
{
  "ownerNumber": "5511999999999",
  "admins": [
    "5511999999999",    ← Seu número aqui
    "5511888888888"
  ]
}
```

**⚠️ Formato correto:** Sem símbolos, apenas números
- ✅ Correto: `"5511999999999"`
- ❌ Errado: `"+55 (11) 99999-9999"`

#### 2. **Bot não é administrador do grupo**
1. Abrir o grupo no WhatsApp
2. Ir em "Informações do grupo" (3 pontinhos)
3. Tocar em "Participantes"
4. Encontrar o bot na lista
5. Tocar no nome do bot → "Tornar administrador do grupo"

#### 3. **Problema com menções**
O WhatsApp às vezes não detecta menções corretamente.

**Teste com novos comandos de debug:**
```
!debug
```
Mostra informações técnicas

```
!testmention @usuario
```
Testa se a menção está sendo detectada

#### 4. **Forma correta de mencionar**
- ❌ Errado: `!kick Joel Leite Morno`
- ✅ Correto: `!kick @⁨Joel Leite Morno⁩` (tocando no nome)

**Como mencionar corretamente:**
1. Digite `!kick ` (com espaço)
2. Toque no nome do usuário na lista de participantes
3. OU digite @ seguido do nome completo
4. Envie a mensagem

### 🧪 **Testando Passo a Passo**

#### Passo 1: Verificar se você é admin
```
!debug
```
Deve mostrar seu número na lista de admins.

#### Passo 2: Testar detecção de menção
```
!testmention @usuario
```
Deve detectar a menção corretamente.

#### Passo 3: Verificar logs do bot
No terminal do Termux onde o bot está rodando, você verá:
- ✅ `Verificando admin: 5511999999999`
- ✅ `É admin? true`
- ✅ `Menção encontrada: 5511888888888`
- ✅ `Tentando remover usuário: 5511888888888`

#### Passo 4: Usar comando com logs detalhados
O novo `!kick` mostra mais informações sobre erros.

### 📋 **Checklist de Verificação**

- [ ] Meu número está em `config.json`?
- [ ] O bot é administrador do grupo?
- [ ] Estou mencionando corretamente o usuário?
- [ ] O usuário mencionado ainda está no grupo?
- [ ] O usuário mencionado não é um admin?
- [ ] O bot está rodando sem erros?

### 🚨 **Mensagens de Erro Comuns**

#### "Você não tem permissão para usar este comando"
- **Causa:** Seu número não está na lista de admins
- **Solução:** Adicionar seu número no `config.json`

#### "Você precisa mencionar um usuário para remover"
- **Causa:** Menção não foi detectada
- **Solução:** Usar `!testmention @usuario` para testar

#### "O bot precisa ser administrador do grupo"
- **Causa:** Bot não tem permissões de admin
- **Solução:** Promover o bot no grupo

#### "Erro ao remover usuário" (403)
- **Causa:** Tentativa de remover um admin ou owner
- **Solução:** Apenas admins podem remover membros comuns

### 🔄 **Reiniciar Bot com Configuração Atualizada**

Após alterar `config.json`:
```bash
# Parar o bot (Ctrl + C)
# Iniciar novamente
node index.js
```

### 📞 **Obter Seu Número Correto**

Para descobrir o formato correto do seu número:
1. Envie `!debug` no grupo
2. Veja o campo "Seu número"
3. Use exatamente esse formato no `config.json`

### 🎯 **Exemplo de Uso Correto**

1. **Configurar admin:**
```json
{
  "ownerNumber": "5511999999999",
  "admins": ["5511999999999"]
}
```

2. **Promover bot a admin no grupo**

3. **Usar comando:**
```
!kick @JoelLeiteMorno
```

4. **Verificar logs no Termux**

### 🆘 **Se Nada Funcionar**

1. Parar o bot (Ctrl + C)
2. Deletar pasta de autenticação:
```bash
rm -rf auth_info/
```
3. Reconectar escaneando novo QR Code
4. Promover bot a admin novamente
5. Testar comando