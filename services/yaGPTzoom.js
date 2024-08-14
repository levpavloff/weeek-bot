const axios = require('axios');
require('dotenv').config();

// Настройка Yandex GPT
const folder_id = process.env.folderId;
const yandexgpt_key = process.env.YAKEY;

async function sendYaGPT(prompt) {

const data = {
    modelUri: `gpt://${folder_id}/yandexgpt/latest`,
    completionOptions: {
        "stream": false,
        "temperature": 0.6,
        "maxTokens": 2000
    },
    "messages": [
        {
            "role": "system",
            "text": "Твоя задача - анализировать пришедший запрос и возвращать в ответ только JSON. Нужно определять, содержится ли в запросе просьба создать созвон / встречу и есть ли там информация об этом созвоне. В начале запроса всегда будет название проекта.\n    В запросе могут быть следующие параметры:\n    - Название проекта (обязательный)\n    - Дата и время встречи с указанием часового пояса (обязательный)\n    - Описание встречи\n    - Участники встречи\n    - Комментарий\n    \n    Если нет проекта, то возвращаем {success: false, reason: 'Отсутствует проект'}\n    Если нет времени, то возвращаем {success: false, reason: 'Отсутствует время'}\n    \n    В остальных случаях возвращаем {success: true, data: JSON}\n    Например - \n    Запрос:\n    HUMANS: Создай созвон на 23 июля 2024 в 12:00 мск. Тема: Обсуждаем правки по дизайну. Участники: @levpavloff, @Anna_Babay. Комментарий: Будем обсуждать финальные правки и должны прийти к четким срокам верстки.\n    Ответ:\n    {\"success\": true, \"data\": {\n      \"project\": \"HUMANS\",\n      \"date\": \"2024-07-23T12:00:00.000Z\",\n      \"description\": \"Обсуждаем правки по дизайну\",\n      \"participants\": [\n        \"@levpavloff\",\n        \"@Anna_Babay\"\n      ],\n      \"comment\": \"Будем обсуждать финальные правки и должны прийти к четким срокам верстки.\"\n    }}\n    \n    Если содержание запроса не содержит просьбу создать созвон, то в ответ нужно выдать JSON с succes false:\n    Запрос: HUMANS: Нарежь огурцов в эту пятницу и приготовься читать\n    {  \"project\": \"HUMANS\",\n      \"success\": false,\n      \"reason\": \"Не содержится просьба создать созвон\"\n    }"
        },
        {
            "role": "user",
            "text": `${prompt}`
        }
    ]
};

try {
    // Отправка запроса к Yandex GPT для генерации ответа
    const response = await axios.post(
        `https://llm.api.cloud.yandex.net/foundationModels/v1/completion`,
        data,
        {
            headers: {
                'Authorization': `Api-Key ${yandexgpt_key}`,
                'x-folder-id': folder_id,
            },
        }
    );

    // Обработка ответа
    const summary = response.data.result && response.data.result.alternatives && response.data.result.alternatives[0] && response.data.result.alternatives[0].message && response.data.result.alternatives[0].message.text
        ? response.data.result.alternatives[0].message.text.trim()
        : 'Ответ от модели не был получен.';
    return summary;

} catch (error) {
    console.error('Error occurred:', error);
} }

module.exports = { sendYaGPT };