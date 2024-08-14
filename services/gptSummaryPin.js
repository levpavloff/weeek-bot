const OpenAI = require("openai");
require('dotenv').config();
const openai = new OpenAI({
    apiKey: process.env.GPTAPI, // Замените на ваш реальный API ключ
});



async function summaryMessage(prompt) {
    const extendedInstructions = `
    Твоя задача - выдавать ровно одно короткое предложение. Я буду присылать тебе текст телеграм-сообщения и его автора. Нужно уместить смысл сообщения в одно краткое предложение.  
  `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Или замените на идентификатор вашей модели, если используете настроенную модель
            messages: [{ role: "system", content: extendedInstructions }, { role: "user", content: prompt }],
            max_tokens: 200,
            n: 1,
            stop: null,
            temperature: 1,
        });
        console.log(response);
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error while sending question to GPT:", error);
        throw error;
    }
}

module.exports = { summaryMessage };
