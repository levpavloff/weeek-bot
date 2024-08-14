const OpenAI = require("openai");
require('dotenv').config();

const openai = new OpenAI({
    apiKey: env.process.GPTAPI, // Замените на ваш реальный API ключ
});



async function sendQuestion(prompt) {
    const extendedInstructions = `
    Твоя задача - анализировать пришедший запрос и возвращать в ответ только JSON. Нужно определять, содержится ли в запросе просьба создать созвон / встречу и есть ли там информация об этом созвоне. В начале запроса всегда будет название проекта.
    В запросе могут быть следующие параметры:
    - Название проекта (обязательный)
    - Дата и время встречи с указанием часового пояса (обязательный)
    - Описание встречи
    - Участники встречи
    - Комментарий
    
    Если нет проекта, то возвращаем {success: false, reason: 'Отсутствует проект'}
    Если нет времени, то возвращаем {success: false, reason: 'Отсутствует время'}
    
    В остальных случаях возвращаем {success: true, data: JSON}
    Например - 
    Запрос:
    HUMANS: Создай созвон на 23 июля 2024 в 12:00 мск. Тема: Обсуждаем правки по дизайну. Участники: @levpavloff, @Anna_Babay. Комментарий: Будем обсуждать финальные правки и должны прийти к четким срокам верстки.
    Ответ:
    {"success": true, "data": {
      "project": "HUMANS",
      "date": "2024-07-23T12:00:00.000Z",
      "description": "Обсуждаем правки по дизайну",
      "participants": [
        "@levpavloff",
        "@Anna_Babay"
      ],
      "comment": "Будем обсуждать финальные правки и должны прийти к четким срокам верстки."
    }}
    
    Если содержание запроса не содержит просьбу создать созвон, то в ответ нужно выдать JSON с succes false:
    Запрос: HUMANS: Нарежь огурцов в эту пятницу и приготовься читать
    {  "project": "HUMANS",
      "success": false,
      "reason": "Не содержится просьба создать созвон"
    }
    
  `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Или замените на идентификатор вашей модели, если используете настроенную модель
            messages: [{ role: "system", content: extendedInstructions }, { role: "user", content: prompt }],
            max_tokens: 500,
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

module.exports = { sendQuestion };
