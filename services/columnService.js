const axios = require('axios');
const weekToken = process.env.WEEK_TOKEN;

const getColumns = async (boardId) => {
    try {
        const response = await axios.get(`https://api.weeek.net/public/v1/tm/board-columns?boardId=${boardId}`, {
            headers: {
                'Authorization': `Bearer ${weekToken}`
            }
        });

        return response.data.boardColumns[0].id; // доски
    } catch (error) {
        console.error(error);
        return null; // Возвращаем пустой массив в случае ошибки
    }
};

module.exports = {
    getColumns,
};
