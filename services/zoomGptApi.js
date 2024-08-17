const OpenAI = require("openai");
require('dotenv').config();
const openai = new OpenAI({
    apiKey: process.env.GPTAPI, // Замените на ваш реальный API ключ
});



async function sendQuestion(project ,prompt) {
    const extendedInstructions = `
    Задача: Анализировать запрос и возвращать JSON-ответ (СТРОГО БЕЗ ОБЕРТКИ В АПОСТРОФЫ MARKDOWN).
Правила обработки запроса:

1. Обязательные параметры:
   - Название проекта. Всегда стоит в начале запроса (типа HUMANS: или IMAGO: или ОРТОПЕДЫ:)
   - Дата и время в разных форматах. Тебе нужно просто перевести дату и время на английский язык и положить в JSON. Даже если это "Завтра в 11 утра" или 24 июня в 21 вечера - пиши прямо так в объект на английском.  

2. Дополнительные НЕОБЯЗАТЕЛЬНЫЕ параметры:
   - Описание встречи. - Можешь переписать на свой взгляд суть встречи, сократить лишний текст и упростить его.
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
     
     HUMANS: Создай созвон на Завтра в 11 утра. Тема: Обсуждаем правки по дизайну. Участники: @levpavloff, @Anna_Babay. Комментарий: Будем обсуждать финальные правки и должны прийти к четким срокам верстки.
     
   - Ответ:
     
     {
       "success": true,
       "data": {
         "project": "HUMANS",
         "date": "Tomorrow at 11 am",
         "description": "Обсуждаем правки по дизайну",
         "participants": ["@levpavloff", "@Anna_Babay"],
         "comment": "Будем обсуждать финальные правки и должны прийти к четким срокам верстки."
       }
     }
  `;
    console.log(project);
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Или замените на идентификатор вашей модели, если используете настроенную модель
            messages: [{ role: "system", content: extendedInstructions }, { role: "user", content: `Проект ${project}:` + prompt }],
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
