const axios = require("axios");

const sendToDeepSeek = async (prompt) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  const body = {
    model: "deepseek-chat",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const response = await axios.post(
    "https://api.deepseek.com/chat/completions",
    body,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const content = response.data.choices[0].message.content;
  return content;
};

module.exports = { sendToDeepSeek };
