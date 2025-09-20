// Estado da aplicação
let appState = {
    botStatus: null,
    groups: [],
    commands: [],
    settings: {},
    socket: null,
    currentEditingCommand: null
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp()
    setupEventListeners()
    connectWebSocket()
})

// Inicializar aplicação
async function initializeApp() {
    showLoading()
    await loadBotStatus()
    await loadGroups()
    await loadCommands()
    await loadSettings()
    hideLoading()
}

// Configurar event listeners
function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab)
        })
    })
    
    // Adicionar comando
    document.getElementById('addCommandBtn').addEventListener('click', () => {
        openCommandModal()
    })
    
    // Modal
    document.getElementById('modalClose').addEventListener('click', closeCommandModal)
    document.getElementById('cancelBtn').addEventListener('click', closeCommandModal)
    
    // Forms
    document.getElementById('commandForm').addEventListener('submit', handleCommandSubmit)
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit)
    
    // Fechar modal clicando fora
    document.getElementById('commandModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeCommandModal()
        }
    })
}

// WebSocket
function connectWebSocket() {
    try {
        appState.socket = new WebSocket('ws://' + window.location.hostname + ':3001')
        
        appState.socket.onopen = () => {
            console.log('🌐 WebSocket conectado')
            showToast('Conectado ao servidor', 'success')
        }
        
        appState.socket.onmessage = (event) => {
            const data = JSON.parse(event.data)
            handleWebSocketMessage(data)
        }
        
        appState.socket.onclose = () => {
            console.log('🌐 WebSocket desconectado')
            showToast('Desconectado do servidor', 'error')
            
            // Tentar reconectar após 3 segundos
            setTimeout(connectWebSocket, 3000)
        }
        
        appState.socket.onerror = (error) => {
            console.error('🌐 Erro WebSocket:', error)
        }
    } catch (error) {
        console.error('🌐 Erro ao conectar WebSocket:', error)
    }
}

// Manipular mensagens WebSocket
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'bot_status':
            appState.botStatus = data.data
            updateBotStatus()
            break
        case 'config_updated':
            showToast('Configuração atualizada', 'success')
            loadGroups()
            loadCommands()
            break
        default:
            console.log('Mensagem WebSocket não tratada:', data)
    }
}

// Carregar status do bot
async function loadBotStatus() {
    try {
        const response = await fetch('/api/status')
        const data = await response.json()
        
        if (data.success) {
            appState.botStatus = data.data
            updateBotStatus()
        }
    } catch (error) {
        console.error('Erro ao carregar status:', error)
        showToast('Erro ao carregar status do bot', 'error')
    }
}

// Atualizar interface com status do bot
function updateBotStatus() {
    const status = appState.botStatus
    
    // Status indicator
    const statusDot = document.getElementById('statusDot')
    const statusText = document.getElementById('statusText')
    
    if (status?.connected) {
        statusDot.classList.add('connected')
        statusText.textContent = 'Conectado'
    } else {
        statusDot.classList.remove('connected')
        statusText.textContent = 'Desconectado'
    }
    
    // Stats
    document.getElementById('totalGroups').textContent = status?.groups?.length || 0
    document.getElementById('activeGroups').textContent = status?.activeGroups || 0
    document.getElementById('totalMessages').textContent = status?.totalMessages || 0
    document.getElementById('customCommands').textContent = appState.commands.length
}

// Carregar grupos
async function loadGroups() {
    try {
        const response = await fetch('/api/groups')
        const data = await response.json()
        
        if (data.success) {
            appState.groups = data.data.groups || []
            renderGroups(data.data.activeGroups || {})
        }
    } catch (error) {
        console.error('Erro ao carregar grupos:', error)
        showToast('Erro ao carregar grupos', 'error')
    }
}

// Renderizar lista de grupos
function renderGroups(activeGroups) {
    const container = document.getElementById('groupsList')
    
    if (!appState.groups.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📱</div>
                <h3>Nenhum grupo encontrado</h3>
                <p>O bot não está em nenhum grupo ainda.<br>Adicione o bot a grupos para gerenciá-los aqui.</p>
            </div>
        `
        return
    }
    
    container.innerHTML = appState.groups.map(group => {
        const isActive = activeGroups[group.id] !== false
        return `
            <div class="group-item ${isActive ? 'active' : ''}">
                <div class="group-info">
                    <div class="group-name">${escapeHtml(group.subject)}</div>
                    <div class="group-id">${group.id}</div>
                    <div class="group-stats">
                        <span class="group-stat">👥 ${group.participants} participantes</span>
                        <span class="group-stat">📅 Criado em ${formatDate(group.creation)}</span>
                    </div>
                </div>
                <div class="group-controls">
                    <label class="toggle-switch">
                        <input type="checkbox" ${isActive ? 'checked' : ''} 
                               onchange="toggleGroup('${group.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `
    }).join('')
}

// Toggle grupo ativo/inativo
async function toggleGroup(groupId, active) {
    try {
        const response = await fetch(`/api/groups/${groupId}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ active })
        })
        
        const data = await response.json()
        
        if (data.success) {
            showToast(data.message, 'success')
            loadGroups()
        } else {
            throw new Error(data.error)
        }
    } catch (error) {
        console.error('Erro ao alterar grupo:', error)
        showToast('Erro ao alterar status do grupo', 'error')
        // Recarregar para reverter mudança visual
        loadGroups()
    }
}

// Carregar comandos
async function loadCommands() {
    try {
        const response = await fetch('/api/commands')
        const data = await response.json()
        
        if (data.success) {
            appState.commands = data.data
            renderCommands()
        }
    } catch (error) {
        console.error('Erro ao carregar comandos:', error)
        showToast('Erro ao carregar comandos', 'error')
    }
}

// Renderizar lista de comandos
function renderCommands() {
    const container = document.getElementById('commandsList')
    
    // Atualizar contador
    document.getElementById('customCommands').textContent = appState.commands.length
    
    if (!appState.commands.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚡</div>
                <h3>Nenhum comando customizado</h3>
                <p>Adicione comandos personalizados para o bot.<br>Clique em "Adicionar Comando" para começar.</p>
            </div>
        `
        return
    }
    
    container.innerHTML = appState.commands.map(command => `
        <div class="command-item">
            <div class="command-header">
                <div class="command-info">
                    <h3>
                        !${command.command}
                        <span class="command-badge ${command.adminOnly ? 'admin' : 'public'}">
                            ${command.adminOnly ? '👨‍💼 Admin' : '👥 Público'}
                        </span>
                    </h3>
                    ${command.description ? `<div class="command-description">${escapeHtml(command.description)}</div>` : ''}
                </div>
                <div class="command-actions">
                    <button class="btn-small btn-edit" onclick="editCommand('${command.id}')">
                        ✏️ Editar
                    </button>
                    <button class="btn-small btn-delete" onclick="deleteCommand('${command.id}')">
                        🗑️ Deletar
                    </button>
                </div>
            </div>
            
            <div class="command-response">${escapeHtml(command.response)}</div>
            
            <div class="command-stats">
                <span>📅 Criado em ${formatDate(command.createdAt)}</span>
                <span>📊 Usado ${command.usage || 0} vezes</span>
                ${command.updatedAt ? `<span>✏️ Editado em ${formatDate(command.updatedAt)}</span>` : ''}
            </div>
        </div>
    `).join('')
}

// Abrir modal de comando
function openCommandModal(command = null) {
    const modal = document.getElementById('commandModal')
    const form = document.getElementById('commandForm')
    const title = document.getElementById('modalTitle')
    const submitBtn = document.getElementById('submitBtnText')
    
    appState.currentEditingCommand = command
    
    if (command) {
        // Edição
        title.innerHTML = '✏️ Editar Comando'
        submitBtn.textContent = 'Salvar'
        
        document.getElementById('commandName').value = command.command
        document.getElementById('commandResponse').value = command.response
        document.getElementById('commandDescription').value = command.description || ''
        document.getElementById('commandAdminOnly').checked = command.adminOnly
    } else {
        // Novo comando
        title.innerHTML = '➕ Adicionar Comando'
        submitBtn.textContent = 'Adicionar'
        form.reset()
    }
    
    modal.classList.add('show')
    document.getElementById('commandName').focus()
}

// Fechar modal de comando
function closeCommandModal() {
    const modal = document.getElementById('commandModal')
    modal.classList.remove('show')
    appState.currentEditingCommand = null
    document.getElementById('commandForm').reset()
}

// Manipular submissão de comando
async function handleCommandSubmit(e) {
    e.preventDefault()
    
    const formData = new FormData(e.target)
    const commandData = {
        command: formData.get('commandName') || document.getElementById('commandName').value,
        response: formData.get('commandResponse') || document.getElementById('commandResponse').value,
        description: formData.get('commandDescription') || document.getElementById('commandDescription').value,
        adminOnly: document.getElementById('commandAdminOnly').checked
    }
    
    // Validação
    if (!commandData.command || !commandData.response) {
        showToast('Nome do comando e resposta são obrigatórios', 'error')
        return
    }
    
    // Limpar nome do comando
    commandData.command = commandData.command.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    if (!commandData.command) {
        showToast('Nome do comando inválido', 'error')
        return
    }
    
    try {
        let response
        
        if (appState.currentEditingCommand) {
            // Editar comando
            response = await fetch(`/api/commands/${appState.currentEditingCommand.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commandData)
            })
        } else {
            // Criar comando
            response = await fetch('/api/commands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commandData)
            })
        }
        
        const data = await response.json()
        
        if (data.success) {
            showToast(data.message, 'success')
            closeCommandModal()
            loadCommands()
        } else {
            throw new Error(data.error)
        }
    } catch (error) {
        console.error('Erro ao salvar comando:', error)
        showToast(error.message || 'Erro ao salvar comando', 'error')
    }
}

// Editar comando
function editCommand(id) {
    const command = appState.commands.find(c => c.id === id)
    if (command) {
        openCommandModal(command)
    }
}

// Deletar comando
async function deleteCommand(id) {
    const command = appState.commands.find(c => c.id === id)
    
    if (!confirm(`Tem certeza que deseja deletar o comando "!${command?.command}"?`)) {
        return
    }
    
    try {
        const response = await fetch(`/api/commands/${id}`, {
            method: 'DELETE'
        })
        
        const data = await response.json()
        
        if (data.success) {
            showToast(data.message, 'success')
            loadCommands()
        } else {
            throw new Error(data.error)
        }
    } catch (error) {
        console.error('Erro ao deletar comando:', error)
        showToast('Erro ao deletar comando', 'error')
    }
}

// Carregar configurações
async function loadSettings() {
    try {
        const response = await fetch('/api/settings')
        const data = await response.json()
        
        if (data.success) {
            appState.settings = data.data
            updateSettingsForm()
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error)
        showToast('Erro ao carregar configurações', 'error')
    }
}

// Atualizar formulário de configurações
function updateSettingsForm() {
    const settings = appState.settings
    
    document.getElementById('autoWelcome').checked = settings.autoWelcome !== false
    document.getElementById('antiSpam').checked = settings.antiSpam === true
    document.getElementById('logActions').checked = settings.logActions !== false
}

// Manipular submissão de configurações
async function handleSettingsSubmit(e) {
    e.preventDefault()
    
    const settings = {
        autoWelcome: document.getElementById('autoWelcome').checked,
        antiSpam: document.getElementById('antiSpam').checked,
        logActions: document.getElementById('logActions').checked
    }
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        })
        
        const data = await response.json()
        
        if (data.success) {
            showToast(data.message, 'success')
            appState.settings = settings
        } else {
            throw new Error(data.error)
        }
    } catch (error) {
        console.error('Erro ao salvar configurações:', error)
        showToast('Erro ao salvar configurações', 'error')
    }
}

// Trocar aba
function switchTab(tabName) {
    // Atualizar botões
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active')
    })
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')
    
    // Atualizar conteúdo
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active')
    })
    document.getElementById(tabName).classList.add('active')
    
    // Carregar dados se necessário
    if (tabName === 'grupos') {
        loadGroups()
    } else if (tabName === 'comandos') {
        loadCommands()
    } else if (tabName === 'configuracoes') {
        loadSettings()
    }
}

// Mostrar toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer')
    const toast = document.createElement('div')
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    }
    
    toast.className = `toast ${type}`
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
    `
    
    container.appendChild(toast)
    
    // Auto remover após 5 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast)
        }
    }, 5000)
}

// Utilidades
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

function formatDate(dateString) {
    if (!dateString) return 'Data desconhecida'
    
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Data inválida'
    
    return date.toLocaleString('pt-BR')
}

function showLoading() {
    // Implementar loading state se necessário
}

function hideLoading() {
    // Implementar loading state se necessário
}

// Atualização periódica do status
setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadBotStatus()
    }
}, 30000) // A cada 30 segundos