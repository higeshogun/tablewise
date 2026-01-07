const Gemini = {
    generateResponse: async (apiKey, modelName, context, question, customInstructions = '') => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        let systemInstruction = 'You are a helpful data analyst.';
        if (customInstructions) {
            systemInstruction += `\n\nCustom Instructions/Context:\n${customInstructions}`;
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
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

    generateSuggestions: async (apiKey, modelName, context, customInstructions = '', lastUserQ = '', lastAiA = '') => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        let systemInstruction = 'You are a helpful data analyst assistant.';
        if (customInstructions) {
            systemInstruction += `\n\nCustom Instructions/Context:\n${customInstructions}`;
        }

        let prompt = `
${systemInstruction}
Here is the data provided by the user:
"""
${context}
"""
`;

        if (lastUserQ && lastAiA) {
            prompt += `
The user just asked: "${lastUserQ}"
You answered: "${lastAiA}"

Based on this conversation and the data, suggest 3 RELEVANT follow-up questions the user might want to ask next.
`;
        } else {
            prompt += `
Based on this data, suggest 3 short, relevant, and interesting questions the user might want to ask.
`;
        }

        prompt += `
Keep them concise (under 10 words).
Format the output as a simple list separated by newlines, with no numbering or bullets.
Example:
What is the total revenue?
Who is the top performer?
Identify any outliers.
        `;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            if (!response.ok) {
                // If suggestions fail, it's not critical, just return empty
                return [];
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            // Clean up the text to get an array
            return text.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('-') && !line.match(/^\d+\./)); // Basic cleanup
        } catch (error) {
            console.warn('Gemini Suggestion Error:', error);
            return []; // Fail silently for suggestions
        }
    },
    listModels: async (apiKey) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Failed to list models');
            }
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Gemini ListModels Error:', error);
            throw error;
        }
    }
};
