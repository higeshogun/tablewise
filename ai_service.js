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
    generateResponse: async (config, context, question, instructions) => {
        const baseUrl = config.baseUrl || 'http://localhost:11434/v1';
        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const model = config.model || 'llama3';

        let systemMsg = 'You are a helpful data analyst.';
        if (instructions) systemMsg += `\n\nContext:\n${instructions}`;
        systemMsg += `\n\nData:\n"""${context}"""`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemMsg },
                        { role: 'user', content: question }
                    ],
                    stream: false,
                    temperature: config.temperature !== undefined ? config.temperature : 0.2
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Local LLM Error: ${err}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Local LLM Error:', error);
            throw error;
        }
    },

    generateSuggestions: async (config, context, instructions, lastQ, lastA, signal) => {
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
                signal: signal // Pass signal here
            });
            if (!response.ok) return [];
            const data = await response.json();
            const text = data.choices[0].message.content;
            return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('-') && !l.match(/^\d+\./));
        } catch (e) {
            if (e.name === 'AbortError') throw e; // Propagate abort
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
