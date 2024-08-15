require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Bot, webhookCallback } = require('grammy');
const chatController = require('./controllers/chatController');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/apiRoutes');
const cors = require('cors');
const { sendQuestion } = require('./services/zoomGptApi');
const {summaryMessage} = require('./services/gptSummaryPin');
//const {sendYaGPT} = require('./services/yaGPTzoom');
const chrono = require('chrono-node');


const app = express();
app.use(cors());
const port = process.env.PORT || 2520;

// Используем bodyParser для обработки JSON-запросов
app.use(bodyParser.json());

// Подключение к базе данных
connectDB()
    .then(() => {
        console.log('Connected to MongoDB');
        // Создаем экземпляр бота после успешного подключения к базе данных
        const bot = new Bot(process.env.BOT_TOKEN);
        app.use(apiRoutes);

        // Монтируем маршрут для обработки вебхук-запросов от Telegram
        app.post('/telegram-webhook', webhookCallback(bot, 'express'));

        app.get('/test', (req, res) => {
            res.send('Test');
        })

        // Обработка команды /start (пример)
        bot.command('start', (ctx) => {
            ctx.reply('Привет! Этот бот для внутреннего пользования команды HUMANS');

            /* const payload = ctx.message.text.split(' ')[1]; // Предполагая, что /start передан с аргументом

            if (payload) {
                const decodedData = Buffer.from(payload, 'base64').toString('utf8');
                chatController.generateApp(ctx, decodedData);
                console.log(JSON.parse(decodedData)); // Теперь вы можете использовать расшифрованные данные
            } else {
                ctx.reply('Привет! Этот бот для внутреннего пользования команды HUMANS')
            } */
        });

        // Обработчик команды /addchat для добавления чата
        bot.command('addchat', async (ctx) => {
            if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
                if (await chatController.checkAdmin(ctx)) {
                    await chatController.addChat(ctx);
                } else {
                    ctx.reply('Вы не являетесь администратором.');
                }
            } else {
                await ctx.reply('Эта команда доступна только в групповых чатах.');
            }
        });

        // Обработчик колбэков для выбора проекта
        bot.callbackQuery(/^project_(.*):(.*)$/, (ctx) => {
            const projectId = ctx.match[1];
            const projectName = ctx.match[2];

            // Теперь у вас есть доступ к projectId и projectName для дальнейшей обработки
            chatController.updateChatProject(ctx, projectId, projectName);
            ctx.editMessageText(`Проект ${projectName} (${projectId}) успешно выбран.`);
        });

        // Обработчик регистрации Zoom конференций
        bot.command('zoom', async (ctx) => {
            // Извлекаем текст после команды /zoom
            const messageText = ctx.message.text.replace('/zoom', '').replace('@hmns_sandbot', '').trim();
            const groupId = ctx.message.chat.id;
            const projectName = await chatController.getProjectName(groupId);
            const response = await sendQuestion(projectName,messageText);
            const obj = JSON.parse(response);
            const utcDate = chrono.parseDate(obj.data.date, new Date(), { forwardDate: true })
            obj.data.date = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);

            await ctx.reply(JSON.stringify(obj), {
                parse_mode: 'Markdown'
            });


        });

        // Обработчик команды /pin
        bot.command('pin', async (ctx) => {
            // Проверяем, является ли это сообщение ответом на другое сообщение
            if (ctx.message.reply_to_message) {
                const repliedMessage = ctx.message.reply_to_message;
                const messageText = repliedMessage.text || repliedMessage.document.file_name + ' ' + repliedMessage.caption || '<Пустое сообщение>';
                const parsedMessage = await summaryMessage(`${repliedMessage.from.first_name} написал: ${messageText}`);


                const params = {
                    id: repliedMessage.message_id,
                    link: `https://t.me/c/${String(repliedMessage.chat.id).slice(4)}/${repliedMessage.message_id}`,
                    message: messageText,
                    author: repliedMessage.from.first_name,
                    date: ctx.message.date,
                    summary: parsedMessage,
                    username: repliedMessage.from.username
                };
                await chatController.saveToPined(params, repliedMessage.chat.id);
                await chatController.addPinnedMessage(ctx, repliedMessage.chat.id);




            } else {
                ctx.reply('Пожалуйста, используйте команду /pin в ответ на сообщение, которое вы хотите закрепить.');
            }
        });

        bot.command('log', async (ctx) => {
            // Проверяем, является ли это сообщение ответом на другое сообщение
            if (ctx.message.reply_to_message) {

                console.log(ctx.message)

            } else {
                ctx.reply('Пожалуйста, используйте команду /log в ответ на сообщение, которое вы хотите проверить.');
            }
        });
        bot.reaction("🎉", (ctx) => console.log('Reaction!'));

        // Запуск сервера
        app.listen(port, () => {
            const options = { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' };
            const formatter = new Intl.DateTimeFormat('ru-RU', options);
            const moscowTime = formatter.format(new Date());

            console.log(`Server is running on port ${port} at ${moscowTime} (МСК)`);

            // Устанавливаем вебхук для бота
            bot.api.setWebhook(`https://server.hmn.su/sandbot/telegram-webhook`);

            console.log(`Webhook has been set up.`);
        });



    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });
