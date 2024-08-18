const axios = require('axios');

// Функция для отправки запроса на Duckling и получения времени
async function getDuckTime(phrase) {
    // Формируем объект с параметрами для запроса
    const data = {
        locale: 'en_US', // Язык, который поддерживает Duckling
        text: phrase, // Фраза, которую нужно распарсить
        dims: ['time'] // Ограничиваем парсинг только временем
    };

    try {
        // Отправляем POST запрос на Duckling
        const response = await axios.post(
            'http://localhost:5320/parse', // URL Duckling
            new URLSearchParams(data), // Преобразуем объект в формат x-www-form-urlencoded
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded' // Заголовок для формата запроса
                }
            }
        );

        // Обрабатываем ответ, извлекая значение времени
        const parsedTime = response.data[0]?.value?.value;

        // Если время было найдено, возвращаем его, иначе возвращаем null
        return parsedTime || null;

    } catch (error) {
        console.error('Error while parsing time with Duckling:', error.message);
        return null;
    }
}

// Экспорт функции
module.exports = { getDuckTime };
