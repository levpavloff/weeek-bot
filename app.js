require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const chatController = require('./controllers/chatController');
const connectDB = require('./config/database');
const {getDetails} = require("./controllers/chatController"); // Импортируйте функцию подключения
const apiRoutes = require('./routes/apiRoutes');


const app = express();
const port = process.env.PORT || 2517;


// Используем bodyParser для обработки JSON-запросов

app.use(bodyParser.json());


// const adminTelegramId = process.env.ADMIN;

// Подключение к базе данных
connectDB()
    .then(() => {
        console.log('Connected to MongoDB');
        // Создаем экземпляр бота после успешного подключения к базе данных
        const bot = new Telegraf(process.env.BOT_TOKEN);
        app.use(apiRoutes);

        // Монтируем маршрут для обработки вебхук-запросов от Telegram
        app.post('/bot/telegram-webhook', (req, res) => {
            const update = req.body;
            bot.handleUpdate(update, res);
        });



        // Обработка команды /start (пример)
        bot.command('start', (ctx) => {
            // Получаем payload из аргумента команды /start
            ctx.reply('Привет! Этот бот для внутреннего пользования команды HUMANS')


            /*const payload = ctx.message.text.split(' ')[1]; // Предполагая, что /start передан с аргументом

            if (payload) {
                const decodedData = Buffer.from(payload, 'base64').toString('utf8');
                chatController.generateApp(ctx, decodedData);
                console.log(JSON.parse(decodedData)); // Теперь вы можете использовать расшифрованные данные
            } else {
                ctx.reply('Привет! Этот бот для внутреннего пользования команды HUMANS')
            }*/
        });


        // Обработчик команды /addchat для добавления чата
        bot.command('addchat', async (ctx) => {
            if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
            if (await chatController.checkAdmin(ctx)) {
                chatController.addChat(ctx);
            } else {
                // Если пользователь не администратор, можно отправить сообщение или выполнить другие действия.
                ctx.reply('Вы не являетесь администратором.');
            }
            } else {
                // Опционально: сообщение пользователю, если команда вызвана не в групповом чате
                await ctx.reply('Эта команда доступна только в групповых чатах.');
            }
        });

        bot.command('task', async (ctx) => {
            // Проверяем, что команда вызвана в групповом чате
            if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
                const access = await chatController.checkAccess(ctx);
                if(access) {

                    function encodeYourData(data) {
                        return Buffer.from(data, 'utf-8').toString('base64');
                    }
                    const encodedData = encodeYourData(`{"chat_id":"${ctx.chat.id}", "user_id":"${ctx.message.from.id}"}`);
                    //const obj = `{"chat_id":"${ctx.chat.id}", "user_id":"${ctx.message.from.id}"}`;


                    // Создание deeplink
                    //const deeplink = `https://t.me/humans_projectbot?start=${encodedData}`;


                    //const webAppUrl = `https://s1.hmns.in/webapp?chat=${ctx.chat.id}&user=${ctx.message.from.id}`;
                    // Отправляем кнопку со ссылкой на приватный чат с ботом
                    await ctx.reply(`Откройте приложение, чтобы поставить задачу \n\n<i>Вы можете использовать одну и ту же кнопку для постановки задач в этом же проекте.</i>`, {
                        reply_markup: {
                            inline_keyboard: [[
                                {
                                    text: 'Открыть приложение',
                                    url: `https://t.me/humans_projectbot/humans_projects?startapp=${encodedData}`
                                }
                            ]]
                        },  parse_mode: 'HTML'
                    });
                }
            } else {
                // Опционально: сообщение пользователю, если команда вызвана не в групповом чате
                await ctx.reply('Эта команда доступна только в групповых чатах.');
            }
        });



        // Обработчик колбэков для выбора проекта
        bot.action(/^project_(.*):(.*)$/, (ctx) => {
            const projectId = ctx.match[1];
            const projectName = ctx.match[2];

            // Теперь у вас есть доступ к projectId и projectName для дальнейшей обработки
            chatController.updateChatProject(ctx, projectId, projectName);
            ctx.editMessageText(`Проект ${projectName} (${projectId}) успешно выбран.`);
            getDetails(projectId);
        });





        // Запуск сервера
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);

            // Устанавливаем вебхук для бота
            bot.telegram.setWebhook(`https://s1.hmns.in/bot/telegram-webhook`);


            console.log(`Webhook has been set up.`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });


