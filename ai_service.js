const TSVParser = {
    parse: (text) => {
        if (!text) return [];
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split('\t').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('\t');
            const row = {};
            // Basic mapping
            headers.forEach((h, idx) => {
                row[h] = values[idx] ? values[idx].trim() : '';
            });
            data.push(row);
        }
        return { headers, data };
    }
};

const SandboxInterface = {
    iframe: null,
    pendingResolvers: {},

    init: () => {
        if (document.getElementById('sandbox-frame')) {
            SandboxInterface.iframe = document.getElementById('sandbox-frame');
            return;
        }
        const iframe = document.createElement('iframe');
        iframe.id = 'sandbox-frame';
        iframe.src = 'sandbox.html';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        SandboxInterface.iframe = iframe;

        window.addEventListener('message', (event) => {
            if (event.data.success !== undefined && SandboxInterface.pendingResolvers['filter']) {
                SandboxInterface.pendingResolvers['filter'](event.data);
                delete SandboxInterface.pendingResolvers['filter'];
            }
        });
    },

    executeFilter: (code, data) => {
        if (!SandboxInterface.iframe) SandboxInterface.init();

        return new Promise((resolve) => {
            SandboxInterface.pendingResolvers['filter'] = resolve;
            // Give iframe a moment to load if just created
            setTimeout(() => {
                SandboxInterface.iframe.contentWindow.postMessage({
                    command: 'filter',
                    context: code,
                    data: data
                }, '*');
            }, 100);
        });
    }
};

const GeminiProvider = {
    generateResponse: async (config, context, question, instructions) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

        let systemInstruction = 'You are a helpful data analyst.';
        if (instructions) {
            systemInstruction += `\n\nCustom Instructions/Context:\n${instructions}`;
        }

        const prompt = `
${systemInstruction}
Here is the data provided by the user (likely from a clipboard copy of a spreadsheet or table):
"""
${context}
"""

User Question: ${question}

Please answer the question based on the data provided. Be concise and accurate.
        `;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: config.temperature !== undefined ? config.temperature : 0.2
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to generate response from Gemini.');
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    },

    generateSuggestions: async (config, context, instructions, lastQ, lastA, signal) => {
        // ... (API call for suggestions - usually doesn't need strict temp control, sticking to defaults or reusing config if needed)
        // For simplicity, we'll keep suggestions at default temp or use config if essential. 
        // Let's implement it for consistency.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        // ... (rest of prompt construction)
        // ... 

        // RE-IMPLEMENTING generateSuggestions to avoid breaking valid code block
        let systemInstruction = 'You are a helpful data analyst assistant.';
        if (instructions) systemInstruction += `\n\nCustom Instructions:\n${instructions}`;

        let prompt = `${systemInstruction}\nData:\n"""${context}"""\n`;

        if (lastQ && lastA) {
            prompt += `User asked: "${lastQ}"\nYou answered: "${lastA}"\nBased on this, suggest 3 RELEVANT follow-up questions.\n`;
        } else {
            prompt += `Suggest 3 short, relevant questions about this data.\n`;
        }

        prompt += `Keep them concise (under 10 words). List format, no numbering.`;

        try {
            // Gemini API call
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7 // Keep suggestions a bit creative/diverse
                    }
                })
            });
            if (!response.ok) return [];
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('-') && !l.match(/^\d+\./));
        } catch (e) {
            return [];
        }
    },

    listModels: async (config) => {
        if (!config.apiKey) throw new Error('API Key required');
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to list Gemini models');
        const data = await response.json();
        return data.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).map(m => m.name.replace('models/', ''));
    }
};

const LocalProvider = {
    // Helper to call Ollama
    callLLM: async (config, systemMsg, userMsg, tempOverride) => {
        const baseUrl = config.baseUrl || 'http://localhost:11434/v1';
        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const model = config.model || 'llama3';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: userMsg }
                ],
                stream: false,
                temperature: tempOverride !== undefined ? tempOverride : (config.temperature !== undefined ? config.temperature : 0.2)
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Local LLM Error: ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    },

    generateResponse: async (config, context, question, instructions) => {
        // 1. Parsing Step
        const { headers, data } = TSVParser.parse(context);

        // Debug Data Parsing
        if (headers) console.log('[Agentic] Parsed Headers:', headers);
        if (data && data.length > 0) console.log('[Agentic] First Row Sample:', data[0]);

        // If parsing fails or data is small, fallback to standard RAG
        if (!headers || headers.length === 0 || data.length < 5) {
            // Fallback
            let systemMsg = 'You are a helpful data analyst.';
            if (instructions) systemMsg += `\n\nContext:\n${instructions}`;
            systemMsg += `\n\nData:\n"""${context}"""`;
            return await LocalProvider.callLLM(config, systemMsg, question);
        }

        // 2. Planning Step (Agentic)
        // Ask LLM for a filter function
        const planSystem = `You are a JavaScript Expert. 
        Your task is to write a javascript function body to filter a list of row objects.
        The function body should assume a variable 'row' exists.
        'row' is an object with keys: ${JSON.stringify(headers)}.
        
        CRITICAL RULES:
        1. Return ONLY the javascript code for the function body. No markdown.
        2. USE EXACT COLUMN NAMES: The 'row' keys are case-sensitive. Use the exact keys provided above.
           Example: if keys are ['PRICE'], use row['PRICE'], NOT row['Price'].
        3. Be robust: Convert values to lowercase for string comparison.
        4. Handle numbers safely (e.g. parseFloat).
        5. Use loose matching (includes) rather than strict equality for text.
        6. IGNORE PUNCTUATION: When searching for IDs or codes, remove non-alphanumeric chars.
           e.g. matching "audusd" should find "AUD/USD".
           Snippet: (row['Col']||'').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes('audusd')
        
        Example: 
        return (row['Instrument']||'').replace(/[^a-z0-9]/gi,'').includes('audusd');
        `;

        const planPrompt = `User Question: "${question}"
        Write the JS condition to find relevant rows.`;

        // Use low temp for code generation
        let funcBody;
        try {
            // console.log('[Agentic] Asking Planner...');
            funcBody = await LocalProvider.callLLM(config, planSystem, planPrompt, 0.0);
            // Cleanup in case LLM adds backticks
            funcBody = funcBody.replace(/```javascript/g, '').replace(/```/g, '').trim();
            // console.log('[Agentic] Generated Plan:', funcBody);
        } catch (e) {
            console.warn('[Agentic] Planning failed, falling back', e);
            funcBody = null;
        }

        // 3. Execution Step
        let filteredContext = context;
        if (funcBody) {
            try {
                const result = await SandboxInterface.executeFilter(funcBody, data);
                // console.log('[Agentic] Sandbox Result:', result); 
                if (result.success && Array.isArray(result.result) && result.result.length > 0) {
                    // Reconstruct simplified context
                    const subset = result.result.slice(0, 50); // Limit to top 50 matches to save context
                    const subsetHeaders = headers.join('\t');
                    const subsetRows = subset.map(r => headers.map(h => r[h]).join('\t')).join('\n');
                    filteredContext = `${subsetHeaders}\n${subsetRows}`;

                    if (result.result.length > 50) {
                        filteredContext += `\n...(and ${result.result.length - 50} more matching rows)`;
                    }
                } else {
                    console.warn('Filter returned 0 results or error, using full context.');
                }
            } catch (e) {
                console.warn('Sandbox execution failed', e);
            }
        }

        // 4. Final Answer Step
        let finalSystem = 'You are a helpful data analyst.';
        if (instructions) finalSystem += `\n\nContext:\n${instructions}`;
        finalSystem += `\n\nFiltered/Relevant Data:\n"""${filteredContext}"""`;

        return await LocalProvider.callLLM(config, finalSystem, question);
    },

    generateSuggestions: async (config, context, instructions, lastQ, lastA, signal) => {
        // Reuse callLLM but need to handle signal manually or just catch abort in callLLM (not added there yet)
        // For now, suggestions are simple enough to not need the full Agentic pipeline
        const baseUrl = config.baseUrl || 'http://localhost:11434/v1';
        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const model = config.model || 'llama3';

        let prompt = `Data:\n"""${context}"""\n`;
        if (instructions) prompt += `Context: ${instructions}\n`;

        if (lastQ) {
            prompt += `User: ${lastQ}\nAI: ${lastA}\nSuggest 3 follow-up questions.`;
        } else {
            prompt += `Suggest 3 questions about this data.`;
        }
        prompt += ` Concise, list format, no numbering.`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    stream: false
                }),
                signal: signal
            });
            if (!response.ok) return [];
            const data = await response.json();
            const text = data.choices[0].message.content;
            return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('-') && !l.match(/^\d+\./));
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            console.warn('Local LLM Suggestions Error:', e);
            return [];
        }
    },

    listModels: async (config) => {
        const baseUrl = config.baseUrl || 'http://localhost:11434/v1';
        const url = `${baseUrl.replace(/\/$/, '')}/models`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to list Local models');
            const data = await response.json();
            return data.data.map(m => m.id);
        } catch (error) {
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                throw new Error('Connection failed. Make sure Ollama is running and OLLAMA_ORIGINS="*" is set.');
            }
            throw error;
        }
    }
};

const AIService = {
    generateResponse: async (config, context, question, instructions) => {
        const provider = config.provider === 'local' ? LocalProvider : GeminiProvider;
        return await provider.generateResponse(config, context, question, instructions);
    },
    generateSuggestions: async (config, context, instructions, lastQ, lastA, signal) => {
        const provider = config.provider === 'local' ? LocalProvider : GeminiProvider;
        // Gemini doesn't imply signal support yet but that is fine, JS ignores extra args. 
        // We mainly need it for LocalProvider where queuing is an issue.
        return await provider.generateSuggestions(config, context, instructions, lastQ, lastA, signal);
    },
    listModels: async (config) => {
        const provider = config.provider === 'local' ? LocalProvider : GeminiProvider;
        return await provider.listModels(config);
    }
};
