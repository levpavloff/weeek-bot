const Chat = require('../models/chatModel');
const Session = require('../models/sessionModel');
const Admin = require('../models/adminModel');
const projectService = require('../services/projectService');
const boardService = require('../services/boardService');
const { Markup } = require('telegraf');
const axios = require('axios');

const adminTelegramId = process.env.ADMIN;
const botToken = process.env.BOT_TOKEN;

// *** РАБОТА С СЕССИЕЙ ***



// Cохранение сессии для текущего пользователя
// Заводим в базу БД о том, что текущий пользователь подключает чат
async function saveSession(userId, updateId, groupId, messageId) {
    try {
        let session = await Session.findOne({chat_id:userId});
        if(!session) {
            session = new Session({chat_id:userId, update_id:updateId, message_id: messageId, last_group: groupId})
        await session.save();
        }

    } catch (error) {
        console.error('Ошибка при сохранении сессии:', error);
    }
}

// Запрос сессии по ID телеграм-юзера
// Вытаскиваем из БД объект сессии
async function getSession(userId) {
    try {
        const session = await Session.findOne({ chat_id: userId });
        if (session) {
            return session;
        } else {
            return null;

        }
    } catch (error) {
        console.error('Ошибка при поиске chat_id по update_id:', error);
        return null;
    }
}

// Удаление сессии по ID телеграм-юзера
// Удаляем из БД объект сессии после завершения подключения чата
async function removeSession(userId){
    try {
        const session = await Session.findOne({ chat_id: userId });
        if (session) {
            await Session.findOneAndDelete({ chat_id: userId });
            return true
        } else {
            return null;

        }
    } catch (error) {
        console.error('Ошибка при поиске chat_id:', error);
        return null;
    }
}

// *** ПРОВЕРКИ АДМИНОВ И ДОСТУПОВ ***

// Проверка, является ли пользователь администратором бота
const checkAdmin = async (ctx) => {
    const userId = ctx.message.from.id;
    try {
        const admin = await Admin.findOne({ admins_id: userId });
        if (admin && admin.admins_id.includes(userId)) {
            console.log(`Пользователь с ID ${userId} является администратором.`);
            return true;
        } else {
            console.log(`Пользователь с ID ${userId} не является администратором.`);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при проверке админа:', error);
        return false;
    }
}

// Проверка, является ли пользователь администратором в группе (права добавлять задачи)
const checkAccess = async (ctx) => {
    const chatId = ctx.message.chat.id;
    const userId = ctx.message.from.id;
    try {
        const admins = await ctx.telegram.getChatAdministrators(chatId);
        const adminsId = admins.map(admin => {
            return admin.user.id;
        })
        if(adminsId.includes(userId))  {
            console.log(`Пользователь с ID ${userId} может добавлять задачи.`);
            return true
        } else {
            console.log(`Пользователь с ID ${userId} не может добавлять задачи.`);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при проверке прав:', error);
        return false;
    }
}



// *** РАБОТА С ПРОЕКТОМ ***
// Добавление чата и отправка выборки проектов
const addChat = async (ctx) => {
    const userId = ctx.message.from.id;
    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;
    const updateId = ctx.update.update_id; // Получаем update_id из контекста
    try {
        // Сохраняем или обновляем чат в базе данных с update_id
        await saveSession(userId,updateId, chatId, messageId); // Используем функцию saveUpdateId для сохранения update_id
        const projects = await projectService.getProjects();
        if (projects.length === 0) {
            await ctx.telegram.sendMessage(userId, 'Не удалось получить список проектов.');
            return;
        }
        const buttons = projects.map((project) => {
            const callbackData = `project_${project.id}:${project.name}`;
            return Markup.button.callback(project.name, callbackData);
        });

// Устанавливаем опцию columns в 2 для отображения кнопок по две в строке
        const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });

// Отправляем сообщение с инлайн-кнопками в личку администратору бота
        await ctx.telegram.sendMessage(userId, 'Выберите проект:', keyboard);

    } catch (error) {
        console.error(error);
        await ctx.telegram.sendMessage(adminTelegramId, 'Произошла ошибка при добавлении/обновлении чата.');
    }
};


// Запрос деталей для сохранения досок проекта
const getDetails = async(ctx, projectId) => {
    try {
        let chat = await Chat.findOne({ "project.id": projectId });
        if(!chat) {
            console.log('При запросе деталей проекта не нашли его по ID')
        }

        let boardsRaw = await boardService.getBoards(projectId);
        chat.project.boards = boardsRaw.map(board => {
            return {id: board.id, name: board.name}
        });
        chat.save();

    } catch (error) {
        console.error(error);
        await ctx.telegram.sendMessage(adminTelegramId, 'Произошла ошибка при добавлении/обновлении чата.');
    }
}


// Функция для обновления проекта в чате
const updateChatProject = async (ctx, projectId, projectName) => {
    try {
        const userId = ctx.callbackQuery.from.id;
        const session = await getSession(userId);
        if(!session){
            console.log('Не нашли сессию при обновлении проектов');
        }
        const groupChatId = session.last_group;

        const admins = await ctx.telegram.getChatAdministrators(groupChatId);
        const adminsId = admins.map(admin => {
            return admin.user.id;
        })

        let chat = await Chat.findOne({ 'project.id': projectId });
        if (!chat) {
            await Chat.findOneAndDelete({chat_id: groupChatId});
            // Если чат не существует, создаем новый
            chat = new Chat({ chat_id: groupChatId, 'project.id': projectId, 'project.name': projectName, 'users': adminsId });
            await chat.save();

        } else {
           chat = await Chat.updateOne({ 'project.id': projectId }, { $set: {chat_id: groupChatId, 'project.name': projectName, 'users': adminsId  } });
        }
        console.log('Проект успешно обновлен.');

        await getDetails(ctx, projectId);
        await removeSession(userId);
        // Отправка сообщения в закреп

        function encodeYourData(data) {
            return Buffer.from(data, 'utf-8').toString('base64');
        }
        const encodedData = encodeYourData(`{"chat_id":"${groupChatId}"}`);
        const startMessage = await ctx.telegram.sendMessage(groupChatId, `<b>Проект ${projectName} успешно подключен к этому чату.</b> \n\nОткройте приложение, чтобы поставить задачу. О новых задачах я буду уведомлять наших проджектов в этот чат\n\n<i>Вы можете использовать одну и ту же кнопку для постановки задач в этом же проекте. Для удобства я вывел кнопке в закреп 👆</i>`, {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: 'Поставить задачу ✅',
                        url: `https://t.me/humans_projectbot/humans_projects?startapp=${encodedData}`
                    }
                ]]
            },  parse_mode: 'HTML'
        });

        await ctx.telegram.pinChatMessage(groupChatId, startMessage.message_id);

    } catch (error) {
        console.error(error);
        console.log('Произошла ошибка при обновлении проекта.');
    }
};


// Функция для отправке в группу уведомления о поставленной задаче
async function sendResMsg(project, data) {
    try{
        const chat = await Chat.findOne({'project.id': project});
        if(!chat) {
            return false;
        }
        const groupId = chat.chat_id;
        const taskId = data.id;
        const taskName = data.title;
        const text = `Поставлена новая задача №${taskId}!\n\nНазвание: ${taskName}`;
        await sendMessageToTelegram(groupId, text);
    } catch (err) {
        console.log(err);
    }

}

// Функция для прямой отправки сообщения в телеграм
async function sendMessageToTelegram(chatId, text) {
    try {
        const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await axios.post(apiUrl, {
            chat_id: chatId,
            text: text,
        });

        // Обработка успешной отправки сообщения
        console.log('Сообщение успешно отправлено:', response.data);
    } catch (error) {
        // Обработка ошибок отправки
        console.error('Ошибка отправки сообщения:', error);
    }
}






module.exports = {
    addChat,
    updateChatProject,
    checkAdmin,
    getDetails,
    checkAccess,
    sendResMsg,
};
