document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const settingsBtn = document.getElementById('settings-btn');
    const backBtn = document.getElementById('back-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const scanPageBtn = document.getElementById('scan-page-btn');
    const clearBtn = document.getElementById('clear-btn');
    const tableSelection = document.getElementById('table-selection');
    const tableListContainer = document.getElementById('table-list');
    const cancelSelectionBtn = document.getElementById('cancel-selection');
    const clipboardPreview = document.getElementById('clipboard-preview');
    const chatContainer = document.getElementById('chat-container');
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const apiKeyInput = document.getElementById('api-key');
    const modelNameInput = document.getElementById('model-name');
    const customModelNameInput = document.getElementById('custom-model-name');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const saveStatus = document.getElementById('save-status');
    const customInstructionsInput = document.getElementById('custom-instructions');
    const refreshBtn = document.getElementById('refresh-btn');

    // State
    let apiKey = '';
    let modelName = 'gemini-1.5-flash-001';
    let currentDataContext = '';
    let chatMessages = []; // Array to store history {sender, text}
    let customInstructions = '';
    let dataSource = { type: null, id: null }; // page or clipboard, table name

    // Initialize
    loadSettings();

    // Event Listeners
    settingsBtn.addEventListener('click', () => {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
    });

    backBtn.addEventListener('click', () => {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', clearChat);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }

    if (cancelSelectionBtn) {
        cancelSelectionBtn.addEventListener('click', () => {
            tableSelection.classList.add('hidden');
            analyzeBtn.classList.remove('hidden');
            scanPageBtn.classList.remove('hidden');
            resetAnalyzeBtn();
            scanPageBtn.disabled = false;
            scanPageBtn.innerHTML = '<span class="btn-icon">🔍</span> Analyze Page';
        });
    }

    // Toggle Custom Input
    modelNameInput.addEventListener('change', () => {
        if (modelNameInput.value === 'custom') {
            customModelNameInput.style.display = 'block';
        } else {
            customModelNameInput.style.display = 'none';
        }
    });

    saveKeyBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        let model = modelNameInput.value;
        const instructions = customInstructionsInput.value.trim();

        if (model === 'custom') {
            model = customModelNameInput.value.trim();
        }

        model = model || 'gemini-1.5-flash';

        if (key) {
            await chrome.storage.local.set({
                'gemini_api_key': key,
                'gemini_model_name': model,
                'gemini_custom_instructions': instructions
            });
            apiKey = key;
            modelName = model;
            customInstructions = instructions;
            showStatus('Settings saved successfully!', 'green');
            setTimeout(() => {
                showStatus('', '');
                settingsView.classList.add('hidden');
                mainView.classList.remove('hidden');
            }, 1000);
        } else {
            showStatus('Please enter a valid key.', 'red');
        }
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!apiKey) {
            alert('Please set your Gemini API Key in Settings first.');
            return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="btn-icon">⏳</span> Reading Clipboard...';

        try {
            // Read clipboard
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText) {
                throw new Error('Clipboard is empty.');
            }

            // Identify if it looks like table data
            const analysis = ClipboardUtils.analyzeContent(clipboardText);

            if (analysis.isTable) {
                handleDataLoaded(clipboardText, analysis.rows, analysis.cols, 'Clipboard Data', 'clipboard');
            } else {
                throw new Error('Clipboard content does not look like tabular data (CSV/TSV).');
            }
        } catch (error) {
            console.error(error);
            alert(error.message || 'Failed to analyze clipboard.');
            resetAnalyzeBtn();
        }
    });

    if (scanPageBtn) {
        scanPageBtn.addEventListener('click', async () => {
            if (!apiKey) {
                alert('Please set your Gemini API Key in Settings first.');
                return;
            }

            scanPageBtn.disabled = true;
            scanPageBtn.innerHTML = '<span class="btn-icon">⏳</span> Scanning Page...';

            await scanAndLoadPage();
        });
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Functions

    async function scanAndLoadPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                throw new Error('No active tab found.');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['page_scanner.js']
            });

            if (!results || !results[0] || !results[0].result) {
                throw new Error('Failed to run script on page (or no result).');
            }

            const result = results[0].result;

            if (result.success && result.tables && result.tables.length > 0) {
                if (result.tables.length === 1) {
                    // Auto-select single table
                    const t = result.tables[0];
                    handleDataLoaded(t.data, t.rows, t.cols, t.name || 'Page Table', 'page', t.name);
                } else {
                    // Show selection UI
                    showTableSelection(result.tables);
                }
            } else {
                throw new Error(result.message || 'No suitable table found on page.');
            }

        } catch (error) {
            console.error(error);
            alert(error.message || 'Failed to scan page.');
            resetScanBtn();
        }
    }

    async function refreshData() {
        if (dataSource.type !== 'page') {
            alert('Can only refresh data from a page scan.');
            return;
        }

        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No tab');

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['page_scanner.js']
            });

            const result = results[0]?.result;
            if (!result || !result.tables) throw new Error('Scan failed');

            // Find matching table
            let matchingTable = result.tables.find(t => t.name === dataSource.id);
            // Fallback to first if only one
            if (!matchingTable && result.tables.length === 1) matchingTable = result.tables[0];

            if (matchingTable) {
                handleDataLoaded(matchingTable.data, matchingTable.rows, matchingTable.cols, matchingTable.name, 'page', matchingTable.name);
                const flash = document.createElement('div');
                flash.className = 'status-msg';
                flash.style.color = 'green';
                flash.textContent = 'Data updated!';
                chatHistory.appendChild(flash);
            } else {
                alert('Could not find the original table on this page.');
            }

        } catch (e) {
            console.error(e);
            alert('Refresh failed: ' + e.message);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
        }
    }

    function showTableSelection(tables) {
        // Hide main buttons
        analyzeBtn.classList.add('hidden');
        scanPageBtn.classList.add('hidden');

        // Populate list
        tableListContainer.innerHTML = '';
        tables.forEach(table => {
            const btn = document.createElement('button');
            btn.className = 'secondary-btn'; // Re-use style
            btn.style.textAlign = 'left';
            btn.style.justifyContent = 'flex-start';
            btn.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-weight:600; font-size:13px;">${table.name}</span>
                    <span style="font-size:11px; color:var(--text-secondary);">${table.type} • ${table.rows} rows x ${table.cols} cols</span>
                </div>
            `;
            btn.addEventListener('click', () => {
                handleDataLoaded(table.data, table.rows, table.cols, table.name, 'page', table.name);
                tableSelection.classList.add('hidden');
            });
            tableListContainer.appendChild(btn);
        });

        tableSelection.classList.remove('hidden');
    }

    async function loadSettings() {
        // Load API settings + Persistence
        const result = await chrome.storage.local.get([
            'gemini_api_key',
            'gemini_model_name',
            'gemini_custom_instructions',
            'chat_history',
            'data_context',
            'data_meta',
            'data_source'
        ]);

        if (result.gemini_api_key) {
            apiKey = result.gemini_api_key;
            apiKeyInput.value = apiKey;
        }
        if (result.gemini_custom_instructions) {
            customInstructions = result.gemini_custom_instructions || '';
            customInstructionsInput.value = customInstructions;
        }
        if (result.gemini_model_name) {
            modelName = result.gemini_model_name;

            // Check if modelName is one of the dropdown values
            const options = Array.from(modelNameInput.options).map(opt => opt.value);
            if (options.includes(modelName)) {
                modelNameInput.value = modelName;
                customModelNameInput.style.display = 'none';
            } else {
                modelNameInput.value = 'custom';
                customModelNameInput.value = modelName;
                customModelNameInput.style.display = 'block';
            }
        }

        // Restore Persistence
        if (result.data_context && result.data_meta) {
            currentDataContext = result.data_context;
            chatMessages = result.chat_history || [];
            dataSource = result.data_source || { type: 'clipboard', id: null };

            // Restore UI state
            updateUIForData(result.data_meta.rows, result.data_meta.cols, result.data_meta.name);

            // Restore chat bubbles
            chatHistory.innerHTML = '';
            chatMessages.forEach(msg => {
                renderMessage(msg.sender, msg.text);
            });

            if (clearBtn) clearBtn.style.display = 'block';
        }
    }

    function showStatus(msg, color) {
        saveStatus.textContent = msg;
        saveStatus.style.color = color;
    }

    async function handleDataLoaded(data, rows, cols, sourceLabel, sourceType = 'clipboard', sourceId = null) {
        currentDataContext = data;
        dataSource = { type: sourceType, id: sourceId };

        // Only clear chat if it's a completely new source (not a refresh)
        if (!chatMessages) chatMessages = [];

        // If it's a new load (no messages) or different source, clear. 
        if (chatMessages.length === 0) {
            chatHistory.innerHTML = ''; // Clear UI
            addMessage('ai', `I have analyzed the **${sourceLabel}**. What would you like to know?`);
            // Generate suggestions (async)
            generateAndShowSuggestions(data, customInstructions);
        }

        updateUIForData(rows, cols, sourceLabel);

        // Save State
        await chrome.storage.local.set({
            'data_context': data,
            'data_meta': { rows, cols, name: sourceLabel },
            'chat_history': chatMessages,
            'data_source': dataSource
        });

        if (clearBtn) clearBtn.style.display = 'block';
    }

    function updateUIForData(rows, cols, sourceLabel) {
        // Update UI
        clipboardPreview.innerHTML = `
            <div style="text-align: left; font-size: 13px;">
                <p><strong>${sourceLabel} Detected:</strong> ${rows} rows, ${cols} columns.</p>
                <p class="help-text" style="margin-top: 4px;">Model: ${modelName}</p>
            </div>
            <button id="refresh-btn" class="icon-btn" title="Refresh Data" style="position: absolute; top: 12px; right: 12px; ${dataSource.type === 'page' ? '' : 'display:none;'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
        `;

        // Re-attach listener because we overwrote innerHTML
        const newRefreshBtn = document.getElementById('refresh-btn');
        if (newRefreshBtn) {
            newRefreshBtn.addEventListener('click', refreshData);
        }

        // Hide buttons to simplify view
        analyzeBtn.classList.add('hidden');
        if (scanPageBtn) scanPageBtn.classList.add('hidden');
        if (tableSelection) tableSelection.classList.add('hidden');

        chatContainer.classList.remove('hidden');
        userInput.disabled = false;
        sendBtn.disabled = false;
    }

    async function clearChat() {
        // Clear Storage
        await chrome.storage.local.remove(['chat_history', 'data_context', 'data_meta', 'data_source']);

        // Reset State
        currentDataContext = '';
        chatMessages = [];
        dataSource = { type: null, id: null };

        // Reset UI
        chatHistory.innerHTML = '';
        chatContainer.classList.add('hidden');
        if (clearBtn) clearBtn.style.display = 'none';

        clipboardPreview.innerHTML = `
             <p>Copy tabular data (Excel, Sheets, etc.) and click below.</p>
             <button id="refresh-btn" class="icon-btn" title="Refresh Data" style="display: none; position: absolute; top: 8px; right: 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
             </button>
        `;
        clipboardPreview.classList.add('empty-state');

        // Show Buttons
        resetAnalyzeBtn();
        resetScanBtn();
    }

    function resetAnalyzeBtn() {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="btn-icon">✨</span> Analyze Clipboard';
        analyzeBtn.classList.remove('hidden');
    }

    function resetScanBtn() {
        if (scanPageBtn) {
            scanPageBtn.disabled = false;
            scanPageBtn.innerHTML = '<span class="btn-icon">🔍</span> Analyze Page';
            scanPageBtn.classList.remove('hidden');
        }
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage('user', text);
        userInput.value = '';
        userInput.disabled = true;
        sendBtn.disabled = true;

        try {
            addLoadingMessage();
            const response = await Gemini.generateResponse(apiKey, modelName, currentDataContext, text, customInstructions);
            addMessage('ai', response);

            // Generate follow-up suggestions
            generateAndShowSuggestions(currentDataContext, customInstructions, text, response);

        } catch (error) {
            addMessage('ai', 'Error: ' + error.message);
        } finally {
            removeLoadingMessage();
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();

            // Save updated history
            chrome.storage.local.set({ 'chat_history': chatMessages });
        }
    }

    // --- Loading Indicator ---
    function addLoadingMessage() {
        // Check if already loading
        if (document.querySelector('.message.loading')) return;

        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'loading');
        msgDiv.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function removeLoadingMessage() {
        const loader = document.querySelector('.message.loading');
        if (loader) loader.remove();
    }

    // --- Suggestions ---
    async function generateAndShowSuggestions(context, instructions, lastQ = '', lastA = '') {
        // Show a mini loading state or just wait?
        // Since it's background, we just wait.
        try {
            const suggestions = await Gemini.generateSuggestions(apiKey, modelName, context, instructions, lastQ, lastA);
            if (suggestions && suggestions.length > 0) {
                renderSuggestions(suggestions);
            }
        } catch (e) {
            console.warn('Failed to load suggestions', e);
        }
    }

    function renderSuggestions(suggestions) {
        // Create container if not exists or append to chat
        const container = document.createElement('div');
        container.classList.add('suggestions-container');

        suggestions.forEach(text => {
            const chip = document.createElement('div');
            chip.classList.add('suggestion-chip');
            chip.textContent = text;
            chip.addEventListener('click', () => {
                userInput.value = text;
                sendMessage();
                container.remove(); // Remove suggestions after click
            });
            container.appendChild(chip);
        });

        chatHistory.appendChild(container);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function addMessage(sender, text) {
        // Add to state
        chatMessages.push({ sender, text });
        renderMessage(sender, text);
    }

    function renderMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);

        // Simple markdown-ish parsing
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/^\* /gm, '• '); // Bullet points (lines starting with "* ")

        msgDiv.innerHTML = formattedText;

        // Add Copy Button for AI messages
        if (sender === 'ai') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy
            `;

            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Copied
                    `;
                    setTimeout(() => {
                        copyBtn.innerHTML = `
                             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                             Copy
                        `;
                    }, 2000);
                });
            });

            actionsDiv.appendChild(copyBtn);
            msgDiv.appendChild(actionsDiv);
        }

        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
});
