const axios = require('axios');
require('dotenv').config();

async function getDeepseekCompletion(messages, options = {}) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
    const model = options.model || 'deepseek-chat';
    const temperature = options.temperature || 0.7;
    const max_tokens = options.max_tokens || 1000;

    const body = {
        model,
        messages,
        temperature,
        max_tokens
    };

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    const response = await axios.post(apiUrl, body, { headers });
    return response.data.choices[0].message.content;
}

module.exports = { getDeepseekCompletion };
