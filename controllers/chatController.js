const Chat = require('../models/chatModel');
const Session = require('../models/sessionModel');
const Admin = require('../models/adminModel');
const Link = require('../models/linksModel');
const projectService = require('../services/projectService');
const boardService = require('../services/boardService');
const { InlineKeyboard } = require('grammy');
const axios = require('axios');

const adminTelegramId = process.env.ADMIN;
const botToken = process.env.BOT_TOKEN;

// *** РАБОТА С СЕССИЕЙ ***

// Cохранение сессии для текущего пользователя
async function saveSession(userId, updateId, groupId, messageId) {
    try {
        let session = await Session.findOne({ chat_id: userId });
        if (!session) {
            session = new Session({ chat_id: userId, update_id: updateId, message_id: messageId, last_group: groupId });
            await session.save();
        }
    } catch (error) {
        console.error('Ошибка при сохранении сессии:', error);
    }
}

// Запрос сессии по ID телеграм-юзера
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
async function removeSession(userId) {
    try {
        const session = await Session.findOne({ chat_id: userId });
        if (session) {
            await Session.findOneAndDelete({ chat_id: userId });
            return true;
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
    const userId = ctx.from.id;
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
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    try {
        const admins = await ctx.api.getChatAdministrators(chatId);
        const adminsId = admins.map(admin => admin.user.id);
        if (adminsId.includes(userId)) {
            console.log(`Пользователь с ID ${userId} может добавлять задачи.`);
            return true;
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
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const messageId = ctx.msg.message_id;
    const updateId = ctx.update.update_id;
    try {
        await saveSession(userId, updateId, chatId, messageId);
        const projects = await projectService.getProjects();
        if (projects.length === 0) {
            await ctx.api.sendMessage(userId, 'Не удалось получить список проектов.');
            return;
        }
        const keyboard = new InlineKeyboard();
        projects.forEach(project => {
            const callbackData = `project_${project.id}:${project.name}`;
            keyboard.text(project.name, callbackData).row();
        });

        await ctx.api.sendMessage(userId, 'Выберите проект:', {
            reply_markup: keyboard
        });
    } catch (error) {
        console.error(error);
        await ctx.api.sendMessage(adminTelegramId, 'Произошла ошибка при добавлении/обновлении чата.');
    }
};

// Запрос деталей для сохранения досок проекта
const getDetails = async (ctx, projectId) => {
    try {
        let chat = await Chat.findOne({ "project.id": projectId });
        if (!chat) {
            console.log('При запросе деталей проекта не нашли его по ID');
            return;
        }

        let boardsRaw = await boardService.getBoards(projectId);
        chat.project.boards = boardsRaw.map(board => ({ id: board.id, name: board.name }));
        await chat.save();
    } catch (error) {
        console.error(error);
        await ctx.api.sendMessage(adminTelegramId, 'Произошла ошибка при добавлении/обновлении чата.');
    }
}

// Функция для обновления проекта в чате
const updateChatProject = async (ctx, projectId, projectName) => {
    try {
        const userId = ctx.from.id;
        const session = await getSession(userId);
        if (!session) {
            console.log('Не нашли сессию при обновлении проектов');
            return;
        }
        const groupChatId = session.last_group;

        const admins = await ctx.api.getChatAdministrators(groupChatId);
        const adminsId = admins.map(admin => admin.user.id);

        let chat = await Chat.findOne({ 'project.id': projectId });
        if (!chat) {
            await Chat.findOneAndDelete({ chat_id: groupChatId });
            chat = new Chat({ chat_id: groupChatId, 'project.id': projectId, 'project.name': projectName, 'users': adminsId });
            await chat.save();
        } else {
            await Chat.updateOne({ 'project.id': projectId }, { $set: { chat_id: groupChatId, 'project.name': projectName, 'users': adminsId } });
        }
        console.log('Проект успешно обновлен.');

        let links = await Link.find();
        const preparedLinks = links.map(link => {
            return {
            text: link.text,
            url: link.url
        }}
        );


        await getDetails(ctx, projectId);
        await removeSession(userId);
        await ctx.api.unpinAllChatMessages(groupChatId)

        function encodeYourData(data) {
            return Buffer.from(data, 'utf-8').toString('base64');
        }

        const encodedData = encodeYourData(`{"chat_id":"${groupChatId}"}`);
        const startMessage = await ctx.api.sendMessage(groupChatId, `<b>Проект ${projectName} успешно подключен к этому чату.</b> \n\nОткройте приложение, чтобы поставить задачу. О новых задачах я буду уведомлять наших проджектов в этот чат\n\n<i>Вы можете использовать одну и ту же кнопку для постановки задач в этом же проекте. Для удобства я вывел кнопку в закреп 👆</i>`, {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: 'Поставить задачу ✅',
                        url: `https://t.me/hmns_sandbot/humans_sandboxapp?startapp=${encodedData}`
                    }
                ]]
            },
            parse_mode: 'HTML'
        });

        // Закрепляем сообщение
        await ctx.api.pinChatMessage(groupChatId, startMessage.message_id);
        const project = await Chat.findOne({ chat_id: groupChatId });
        const messages = project.pinned_messages;
        const prepareLinks = messages.map((message) => {
            return `<a href="${message.link}">- ${message.summary}</a>`;
        })
        const inlineKeyboard = chunkArray(preparedLinks, 2);

        // Отправляем дополнительное сообщение в формате Markdown
        const additionalMessage = await ctx.api.sendMessage(groupChatId, '<b>В этом сообщении мы будем собирать всё самое важное.</b>\n\n' +
            '<blockquote>Это сообщение будет закреплено вверху, чтобы кнопка оставалась на виду. \n' +
            'Чтобы закрепить важное сообщение, просто ответьте на него командой /pin. Я добавлю ссылку на это сообщение сюда и кратко опишу его содержание.</blockquote>\n\n' +
            '<b>Закрепленные сообщения:</b>\n\n' + prepareLinks.join('\n') +
            '\n\n<b>Также здесь будут важные статьи</b> из нашей базы знаний для вашей работы. Обязательно ознакомьтесь:',
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });

        // Сохранение ID дополнительного сообщения в базу данных
        let mainChat= await Chat.findOne({ 'project.id': projectId });
        mainChat.main_message = additionalMessage.message_id;
        await mainChat.save();

    } catch (error) {
        console.error(error);
        console.log('Произошла ошибка при обновлении проекта.');
    }
};

// Функция для отправки в группу уведомления о поставленной задаче
async function sendResMsg(project, data) {
    try {
        const chat = await Chat.findOne({ 'project.id': project });
        if (!chat) {
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

        console.log('Сообщение успешно отправлено:', response.data);
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
    }
}

// Запрос названия проекта по chat_id
async function getProjectName(groupId) {
    try {
        const project = await Chat.findOne({ chat_id: groupId });
        if (project) {
            return project.project.name;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Ошибка при поиске chat_id по update_id:', error);
        return null;
    }
}
async function saveToPined(params, groupId) {
    try {
        const project = await Chat.findOne({ chat_id: groupId });

        if (project) {
           project.pinned_messages.push(params);
           await project.save();
            return true;
        }
    } catch (error) {
        console.error('Ошибка при поиске chat_id по update_id:', error);
        return null;
    }
}

async function addPinnedMessage(ctx,groupId) {
    try {
        let links = await Link.find();
        const preparedLinks = links.map(link => {
            return {
                text: link.text,
                url: link.url
            }}
        );
        const project = await Chat.findOne({ chat_id: groupId });

        if (project) {
            const messages = project.pinned_messages;
            const postMessage = project.main_message;
            const prepareLinks = messages.map((message) => {
                return `<a href="${message.link}">- ${message.summary}</a>`;
            })
            const inlineKeyboard = chunkArray(preparedLinks, 2);
            const updatedMessage = '<b>В этом сообщении мы будем собирать всё самое важное.</b>\n\n' +
                '<blockquote>Это сообщение будет закреплено вверху, чтобы кнопка оставалась на виду. \n' +
                'Чтобы закрепить важное сообщение, просто ответьте на него командой /pin. Я добавлю ссылку на это сообщение сюда и кратко опишу его содержание.</blockquote>\n\n' +
                '<b>Закрепленные сообщения:</b>\n\n' +
                prepareLinks.join('\n') + '\n\n<b>Также здесь будут важные статьи</b> из нашей базы знаний для вашей работы. Обязательно ознакомьтесь:';
            await ctx.api.editMessageText(groupId, postMessage, updatedMessage, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });

        }
    } catch (error) {
        console.error('Ошибка при поиске chat_id по update_id:', error);
        return null;
    }
}

function chunkArray(array, chunkSize) {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
    }
    return result;
}



module.exports = {
    addChat,
    updateChatProject,
    checkAdmin,
    getDetails,
    checkAccess,
    sendResMsg,
    getProjectName,
    saveToPined,
    addPinnedMessage
};
