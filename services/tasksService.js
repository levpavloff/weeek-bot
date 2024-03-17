const axios = require('axios');
const weekToken = process.env.WEEK_TOKEN;

const getTasks = async (projectId) => {
    try {
        const response = await axios.get(`https://api.weeek.net/public/v1/tm/tasks?projectId=${projectId}&perPage=100`, {
            headers: {
                'Authorization': `Bearer ${weekToken}`
            }
        });
        const boards = await axios.get(`https://api.weeek.net/public/v1/tm/boards?projectId=${projectId}`, {
            headers: {
                'Authorization': `Bearer ${weekToken}`
            }
        });
        console.log(boards);
        const boardsArr = boards.boards.map(board => board.id);
        const columns = [];
        for (const board of boardsArr) {
            const column = await axios.get(`https://api.weeek.net/public/v1/tm/board-columns?boardId=${board}`, {
                headers: {
                    'Authorization': `Bearer ${weekToken}`
                }
            });
            column.boardColumns.forEach(el=> {
                columns.push(el);
            })
        }


        // Функция для нахождения названия доски и колонки по id
        function findNameById(id, array) {
            const item = array.find(item => item.id === id);
            return item ? item.name : null;
        }

        response.data.tasks.forEach(task => {
            const boardName = findNameById(task.boardId, boards.boards);
            const boardColumnName = findNameById(task.boardColumnId, columns);
            if (boardName && boardColumnName) {
                task.boardName = boardName;
                task.boardColumnName = boardColumnName;
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
