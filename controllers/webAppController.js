const Chat = require('../models/chatModel');
const columnService = require('../services/columnService');
const { Markup } = require('telegraf');

const adminTelegramId = process.env.ADMIN;

async function prepareTask(params, project) {
    const projectId = project;
    const task = {
        ...params,
        projectId: projectId
    };
    const boardObj = {
        design: 'Дизайн',
        dev: 'Разработка',
        tech: 'Тех',
        other: 'Другое'
    }
    let cat = params.category;
    if(!cat) {
        cat = 'other'
    }
    try {
        const chat = await Chat.findOne({'project.id': projectId});
        if(!chat) {
            return false
        }
        const boardId = chat.project.boards.filter(board => {
            if(board.name.includes(boardObj[cat])){
                return board;
            }
        })[0].id;
        task.boardColumnId = await columnService.getColumns(boardId);

        task.boardId = boardId;
        delete task.category;

        return task


    } catch (err) {
        console.log(err)
    }
}





module.exports = {
    prepareTask,


};