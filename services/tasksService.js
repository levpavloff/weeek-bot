const axios = require('axios');
const weekToken = process.env.WEEK_TOKEN;

const getTasks = async (projectId) => {
    try {
        const response = await axios.get(`https://api.weeek.net/public/v1/tm/tasks?projectId=${projectId}&perPage=50`, {
            headers: {
                'Authorization': `Bearer ${weekToken}`
            }
        });
        return response.data.tasks; // Предполагаем, что API возвращает список проектов в response.data
    } catch (error) {
        console.error(error);
        return []; // Возвращаем пустой массив в случае ошибки
    }
};

const createTask = async (task) => {
    try {
        const response = await axios.post(`https://api.weeek.net/public/v1/tm/tasks`, task,{
            headers: {
                'Authorization': `Bearer ${weekToken}`
            },

        });
        return response.data; // Предполагаем, что API возвращает список проектов в response.data
    } catch (error) {
        console.error(error);
        return []; // Возвращаем пустой массив в случае ошибки
    }
};



module.exports = {
    getTasks,
    createTask
};
