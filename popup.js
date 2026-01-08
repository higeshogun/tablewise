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

    // Settings Elements
    const apiKeyInput = document.getElementById('api-key');
    const providerSelect = document.getElementById('ai-provider');
    const baseUrlInput = document.getElementById('base-url');
    const modelNameInput = document.getElementById('model-name');
    const customModelNameInput = document.getElementById('custom-model-name');
    const temperatureInput = document.getElementById('temperature');
    const tempValueDisplay = document.getElementById('temp-value');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const saveStatus = document.getElementById('save-status');
    const customInstructionsInput = document.getElementById('custom-instructions');
    const geminiSettingsDiv = document.getElementById('gemini-settings');
    const localSettingsDiv = document.getElementById('local-settings');
    const refreshBtn = document.getElementById('refresh-btn');

    // State
    let apiKey = '';
    let provider = 'gemini';
    let baseUrl = 'http://localhost:11434/v1';
    let modelName = 'gemini-1.5-flash-001';
    let temperature = 0.2;
    let currentDataContext = '';
    let chatMessages = [];
    let customInstructions = '';
    let dataSource = { type: null, id: null };

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

    if (clearBtn) clearBtn.addEventListener('click', clearChat);
    if (refreshBtn) refreshBtn.addEventListener('click', refreshData);

    if (cancelSelectionBtn) {
        cancelSelectionBtn.addEventListener('click', () => {
            tableSelection.classList.add('hidden');
            analyzeBtn.style.display = 'block';
            scanPageBtn.style.display = 'block';
            resetAnalyzeBtn();
            resetScanBtn();
        });
    }

    // Toggle Provider
    providerSelect.addEventListener('change', (e) => {
        updateProviderUI(e.target.value);
    });

    function updateProviderUI(selectedProvider) {
        provider = selectedProvider;
        const geminiSettingsDiv = document.getElementById('gemini-settings');
        const localSettingsDiv = document.getElementById('local-settings');
        const apiKeyLabel = document.querySelector('label[for="api-key"]');
        const apiKeyInput = document.getElementById('api-key');

        if (selectedProvider === 'local') {
            geminiSettingsDiv.classList.add('hidden');
            localSettingsDiv.classList.remove('hidden');

            // Local defaults
            if (modelNameInput.value.startsWith('gemini')) {
                modelNameInput.value = 'custom';
                customModelNameInput.style.display = 'block';
                customModelNameInput.value = 'llama3';
            }
        } else if (selectedProvider === 'openrouter') {
            // OpenRouter needs KEY + BaseURL + MaxRows
            geminiSettingsDiv.classList.remove('hidden');
            localSettingsDiv.classList.remove('hidden');

            apiKeyLabel.textContent = 'OpenRouter API Key';
            apiKeyInput.placeholder = 'sk-or-...';

            const baseUrlInput = document.getElementById('base-url');
            if (!baseUrlInput.value || baseUrlInput.value.includes('localhost')) {
                baseUrlInput.value = 'https://openrouter.ai/api/v1';
            }

            if (modelNameInput.value.startsWith('gemini')) {
                modelNameInput.value = 'custom';
                customModelNameInput.style.display = 'block';
                customModelNameInput.value = 'google/gemini-pro';
            }
        } else {
            // Gemini
            geminiSettingsDiv.classList.remove('hidden');
            localSettingsDiv.classList.add('hidden');
            apiKeyLabel.textContent = 'Gemini API Key';
            apiKeyInput.placeholder = 'Enter your Gemini API Key';
        }
    }

    // Toggle Custom Input
    modelNameInput.addEventListener('change', () => {
        if (modelNameInput.value === 'custom') {
            customModelNameInput.style.display = 'block';
        } else {
            customModelNameInput.style.display = 'none';
        }
    });

    temperatureInput.addEventListener('input', (e) => {
        tempValueDisplay.textContent = e.target.value;
    });

    const testKeyBtn = document.getElementById('test-key-btn');
    const modelListDebug = document.getElementById('model-list-debug');

    saveKeyBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        const prov = providerSelect.value;
        const base = baseUrlInput.value.trim() || 'http://localhost:11434/v1';
        let model = modelNameInput.value;
        const instructions = customInstructionsInput.value.trim();
        const temp = parseFloat(temperatureInput.value);

        if (model === 'custom') {
            model = customModelNameInput.value.trim();
        }

        // Defaults
        if (!model) {
            model = prov === 'gemini' ? 'gemini-1.5-flash-001' : 'llama3';
        }

        if ((prov === 'gemini' || prov === 'openrouter') && !key) {
            showStatus('Please enter a valid API key.', 'red');
            return;
        }

        const maxRows = parseInt(document.getElementById('max-rows').value, 10) || 50;

        await chrome.storage.local.set({
            'gemini_api_key': key,
            'gemini_provider': prov,
            'gemini_base_url': base,
            'gemini_model_name': model,
            'gemini_temperature': temp,
            'gemini_custom_instructions': instructions,
            'local_max_rows': maxRows
        });

        apiKey = key;
        provider = prov;
        baseUrl = base;
        modelName = model;
        temperature = temp;
        customInstructions = instructions;

        showStatus('Settings saved!', 'green');
        setTimeout(() => {
            showStatus('', '');
            settingsView.classList.add('hidden');
            mainView.classList.remove('hidden');
        }, 1000);
    });

    if (testKeyBtn) {
        testKeyBtn.addEventListener('click', async () => {
            const tempConfig = {
                apiKey: apiKeyInput.value.trim(),
                provider: providerSelect.value,
                baseUrl: baseUrlInput.value.trim(),
                model: modelNameInput.value,
                temperature: parseFloat(temperatureInput.value)
            };

            if (tempConfig.provider === 'gemini' && !tempConfig.apiKey) {
                alert('Enter an API key first.');
                return;
            }

            testKeyBtn.disabled = true;
            testKeyBtn.innerText = 'Checking...';
            modelListDebug.style.display = 'block';
            modelListDebug.innerText = 'Connecting...';

            try {
                const models = await AIService.listModels(tempConfig);
                modelListDebug.innerText = 'Available Models:\n' + models.join('\n');
                showStatus('Success!', 'green');
            } catch (e) {
                modelListDebug.innerText = 'Error:\n' + e.message;
                showStatus('Failed.', 'red');
            } finally {
                testKeyBtn.disabled = false;
                testKeyBtn.innerText = 'Check Models';
            }
        });
    }

    analyzeBtn.addEventListener('click', async () => {
        if (provider === 'gemini' && !apiKey) {
            alert('Please check your API Key in Settings.');
            settingsBtn.click();
            return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="btn-icon">⏳</span> Reading Clipboard...';

        try {
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText) throw new Error('Clipboard is empty.');

            // Identify if it looks like table data
            const analysis = ClipboardUtils.analyzeContent(clipboardText);

            if (analysis.isTable) {
                handleDataLoaded(clipboardText, analysis.rows, analysis.cols, 'Clipboard Data', 'clipboard');
            } else {
                if (confirm('Clipboard content does not look like a table. Analyze anyway?')) {
                    handleDataLoaded(clipboardText, '?', '?', 'Clipboard Text', 'clipboard');
                }
            }
        } catch (error) {
            console.error(error);
            alert('Failed: ' + error.message);
        } finally {
            resetAnalyzeBtn();
        }
    });

    if (scanPageBtn) {
        scanPageBtn.addEventListener('click', async () => {
            if (provider === 'gemini' && !apiKey) {
                alert('Please check your API Key in Settings.');
                settingsBtn.click();
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
            if (!tab) throw new Error('No active tab.');

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['page_scanner.js']
            });

            const result = results[0]?.result;

            if (result && result.success && result.tables && result.tables.length > 0) {
                if (result.tables.length === 1) {
                    const t = result.tables[0];
                    handleDataLoaded(t.data, t.rows, t.cols, t.name || 'Page Table', 'page', t.name);
                } else {
                    showTableSelection(result.tables);
                }
            } else {
                alert('No tables found on this page.');
                resetScanBtn();
            }
        } catch (error) {
            console.error(error);
            alert('Scan failed: ' + error.message);
            resetScanBtn();
        }
    }

    async function refreshData() {
        if (dataSource.type !== 'page') return;
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

            let matchingTable = result.tables.find(t => t.name === dataSource.id);
            if (!matchingTable && result.tables.length === 1) matchingTable = result.tables[0];

            if (matchingTable) {
                handleDataLoaded(matchingTable.data, matchingTable.rows, matchingTable.cols, matchingTable.name, 'page', matchingTable.name);
                const flash = document.createElement('div');
                flash.className = 'status-msg';
                flash.style.color = 'green';
                flash.textContent = 'Data updated!';
                chatHistory.appendChild(flash);
            } else {
                alert('Could not find table.');
            }

        } catch (e) {
            alert('Refresh failed: ' + e.message);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
        }
    }

    function showTableSelection(tables) {
        analyzeBtn.style.display = 'none';
        scanPageBtn.style.display = 'none';
        tableListContainer.innerHTML = '';
        tables.forEach(table => {
            const btn = document.createElement('button');
            btn.className = 'secondary-btn';
            btn.style.textAlign = 'left';
            btn.innerHTML = `<span style="font-weight:600;">${table.name}</span><br><span style="font-size:11px;color:grey">${table.rows}x${table.cols}</span>`;
            btn.addEventListener('click', () => {
                handleDataLoaded(table.data, table.rows, table.cols, table.name, 'page', table.name);
                tableSelection.classList.add('hidden');
            });
            tableListContainer.appendChild(btn);
        });
        tableSelection.classList.remove('hidden');
    }

    async function loadSettings() {
        const result = await chrome.storage.local.get([
            'gemini_api_key',
            'gemini_provider',
            'gemini_base_url',
            'gemini_model_name',
            'gemini_temperature',
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

        if (result.gemini_provider) {
            provider = result.gemini_provider;
            providerSelect.value = provider;
        }

        if (result.gemini_base_url) {
            baseUrl = result.gemini_base_url;
            baseUrlInput.value = baseUrl;
        }

        updateProviderUI(provider);

        if (result.gemini_custom_instructions) {
            customInstructions = result.gemini_custom_instructions;
            customInstructionsInput.value = customInstructions;
        }

        if (result.gemini_model_name) {
            modelName = result.gemini_model_name;
            const options = Array.from(modelNameInput.options).map(opt => opt.value);
            if (options.includes(modelName)) {
                modelNameInput.value = modelName;
            } else {
                modelNameInput.value = 'custom';
                customModelNameInput.value = modelName;
                customModelNameInput.style.display = 'block';
            }
        }

        if (result.gemini_temperature !== undefined) {
            temperature = result.gemini_temperature;
            temperatureInput.value = temperature;
            tempValueDisplay.textContent = temperature;
        } else {
            // Default
            temperature = 0.2;
            temperatureInput.value = 0.2;
            tempValueDisplay.textContent = 0.2;
        }

        // Load Max Rows
        const maxRowsInput = document.getElementById('max-rows');
        if (result.local_max_rows) {
            maxRowsInput.value = result.local_max_rows;
        } else {
            maxRowsInput.value = 50;
        }

        if (result.data_context && result.data_meta) {
            currentDataContext = result.data_context;
            chatMessages = result.chat_history || [];
            dataSource = result.data_source || { type: 'clipboard', id: null };
            updateUIForData(result.data_meta.rows, result.data_meta.cols, result.data_meta.name);
            chatHistory.innerHTML = '';
            chatMessages.forEach(msg => renderMessage(msg.sender, msg.text));
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

        if (!chatMessages) chatMessages = [];
        if (chatMessages.length === 0) {
            chatHistory.innerHTML = '';
            addMessage('ai', `I have analyzed the **${sourceLabel}**. What would you like to know?`);

            // Suggestions disabled on initial load per user request
            // const config = { apiKey, provider, baseUrl, model: modelName };
            // generateAndShowSuggestions(config, data, customInstructions);
        }

        updateUIForData(rows, cols, sourceLabel);

        await chrome.storage.local.set({
            'data_context': data,
            'data_meta': { rows, cols, name: sourceLabel },
            'chat_history': chatMessages,
            'data_source': dataSource
        });

        if (clearBtn) clearBtn.style.display = 'block';
    }

    function updateUIForData(rows, cols, sourceLabel) {
        clipboardPreview.innerHTML = `
            <div style="text-align: left; font-size: 13px;">
                <p><strong>${sourceLabel}</strong>: ${rows}x${cols}</p>
                <p class="help-text">Model: ${modelName}</p>
            </div>
            <button id="refresh-btn" class="icon-btn" title="Refresh" style="position: absolute; top: 12px; right: 12px; ${dataSource.type === 'page' ? '' : 'display:none;'}">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
        `;

        // Rebind refresh
        const newRef = document.getElementById('refresh-btn');
        if (newRef) newRef.addEventListener('click', refreshData);

        analyzeBtn.style.display = 'none';
        scanPageBtn.style.display = 'none';
        chatContainer.classList.remove('hidden');
        userInput.disabled = false;
        sendBtn.disabled = false;
    }

    async function clearChat() {
        await chrome.storage.local.remove(['chat_history', 'data_context', 'data_meta', 'data_source']);
        currentDataContext = '';
        chatMessages = [];
        dataSource = { type: null, id: null };
        chatHistory.innerHTML = '';
        chatContainer.classList.add('hidden');
        if (clearBtn) clearBtn.style.display = 'none';
        clipboardPreview.innerHTML = '<p>Copy tabular data (Excel, Sheets, etc.) and click below.</p>';
        resetAnalyzeBtn();
        resetScanBtn();
    }

    function resetAnalyzeBtn() {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="btn-icon">✨</span> Analyze Clipboard';
        analyzeBtn.style.display = 'block';
    }

    function resetScanBtn() {
        if (scanPageBtn) {
            scanPageBtn.disabled = false;
            scanPageBtn.innerHTML = '<span class="btn-icon">🔍</span> Analyze Page';
            scanPageBtn.style.display = 'block';
        }
    }

    let suggestionController = null;

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        // Cancel any pending suggestions to free up the Local LLM
        if (suggestionController) {
            suggestionController.abort();
            suggestionController = null;
        }

        addMessage('user', text);
        userInput.value = '';
        userInput.disabled = true;
        sendBtn.disabled = true;

        const maxRows = parseInt(document.getElementById('max-rows').value, 10) || 50;
        const config = { apiKey, provider, baseUrl, model: modelName, temperature: temperature, maxRows: maxRows };

        try {
            addLoadingMessage();
            const response = await AIService.generateResponse(
                config,
                currentDataContext,
                text,
                customInstructions,
                chatMessages,
                (status) => updateLoadingStatus(status)
            );
            addMessage('ai', response);
            generateAndShowSuggestions(config, currentDataContext, customInstructions, text, response);
        } catch (error) {
            addMessage('ai', 'Error: ' + error.message);
        } finally {
            removeLoadingMessage();
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
            chrome.storage.local.set({ 'chat_history': chatMessages });
        }
    }

    function addLoadingMessage() {
        if (document.querySelector('.message.loading')) return;
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'loading');
        // Structure: Dots + Status Text
        msgDiv.innerHTML = `
            <div class="loading-dots">
                <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
            </div>
            <span class="loading-status" style="margin-left: 8px; font-size: 12px; color: #666;"></span>
        `;
        // Flex container to align dots and text
        msgDiv.style.display = 'flex';
        msgDiv.style.alignItems = 'center';

        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function updateLoadingStatus(text) {
        const statusSpan = document.querySelector('.message.loading .loading-status');
        if (statusSpan) {
            statusSpan.textContent = text;
        }
    }

    function removeLoadingMessage() {
        const loader = document.querySelector('.message.loading');
        if (loader) loader.remove();
    }

    async function generateAndShowSuggestions(config, context, instructions, lastQ, lastA) {
        // Create new controller
        suggestionController = new AbortController();
        const signal = suggestionController.signal;

        try {
            const suggestions = await AIService.generateSuggestions(config, context, instructions, lastQ, lastA, signal);
            if (suggestions && suggestions.length > 0) renderSuggestions(suggestions);
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log('Suggestions generation aborted by user action.');
            } else {
                console.warn('Suggestions failed: ', e);
            }
        } finally {
            // Clean up if this was the active controller
            if (suggestionController && suggestionController.signal === signal) {
                suggestionController = null;
            }
        }
    }

    function renderSuggestions(suggestions) {
        const container = document.createElement('div');
        container.classList.add('suggestions-container');
        suggestions.forEach(text => {
            const chip = document.createElement('div');
            chip.classList.add('suggestion-chip');
            chip.textContent = text;
            chip.addEventListener('click', () => {
                userInput.value = text;
                sendMessage();
                container.remove();
            });
            container.appendChild(chip);
        });
        chatHistory.appendChild(container);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function addMessage(sender, text) {
        chatMessages.push({ sender, text });
        renderMessage(sender, text);
    }

    function renderMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);
        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^\* /gm, '• ');
        msgDiv.innerHTML = formattedText;

        if (sender === 'ai') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
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
