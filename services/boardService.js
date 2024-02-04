const axios = require('axios');
const weekToken = process.env.WEEK_TOKEN;

const getBoards = async (projectId) => {
    try {
        const response = await axios.get(`https://api.weeek.net/public/v1/tm/boards?projectId=${projectId}`, {
            headers: {
                'Authorization': `Bearer ${weekToken}`
            }
        });
        return response.data.boards; // Предполагаем, что API возвращает список проектов в response.data
    } catch (error) {
        console.error(error);
        return []; // Возвращаем пустой массив в случае ошибки
    }
};

module.exports = {
    getBoards,
};
