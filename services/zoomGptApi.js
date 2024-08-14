const OpenAI = require("openai");
require('dotenv').config();
const openai = new OpenAI({
    apiKey: process.env.GPTAPI, // Замените на ваш реальный API ключ
});



async function sendQuestion(prompt) {
    const extendedInstructions = `
    Задача: Анализировать запрос и возвращать JSON-ответ.
Правила обработки запроса:

1. Обязательные параметры:
   - Название проекта.
   - Дата и время встречи с указанием часового пояса.

2. Дополнительные параметры:
   - Описание встречи.
   - Участники встречи.
   - Комментарий.

3. Правила валидации:
   - Если отсутствует название проекта, возвращаем:
     
     {"success": false, "reason": "Отсутствует проект"}
     
   - Если отсутствует время, возвращаем:
     
     {"success": false, "reason": "Отсутствует время"}
     
   - Если запрос не содержит просьбу создать созвон/встречу, возвращаем:
     
     {"success": false, "reason": "Не содержится просьба создать созвон"}
     
4. Пример корректного ответа:
   - Запрос:
     
     HUMANS: Создай созвон на 23 июля 2024 в 12:00 мск. Тема: Обсуждаем правки по дизайну. Участники: @levpavloff, @Anna_Babay. Комментарий: Будем обсуждать финальные правки и должны прийти к четким срокам верстки.
     
   - Ответ:
     
     {
       "success": true,
       "data": {
         "project": "HUMANS",
         "date": "2024-07-23T12:00:00.000Z",
         "description": "Обсуждаем правки по дизайну",
         "participants": ["@levpavloff", "@Anna_Babay"],
         "comment": "Будем обсуждать финальные правки и должны прийти к четким срокам верстки."
       }
     }
  `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Или замените на идентификатор вашей модели, если используете настроенную модель
            messages: [{ role: "system", content: extendedInstructions }, { role: "user", content: "HUMANS: " + prompt }],
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
