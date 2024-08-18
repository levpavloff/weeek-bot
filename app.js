require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const {InlineKeyboard, Bot, webhookCallback } = require('grammy');
const chatController = require('./controllers/chatController');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/apiRoutes');
const cors = require('cors');
const { sendQuestion } = require('./services/zoomGptApi');
const {summaryMessage} = require('./services/gptSummaryPin');
const { createZoomMeeting, getAllScheduledMeetings } = require('./services/zoomService');
const { getDuckTime } = require('./services/ducklingService');
const chrono = require('chrono-node');
const moment = require('moment-timezone');
const Chat = require('./models/chatModel');



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

// Функция для конвертации времени в московское время (UTC+3) с использованием luxon
        function convertToMoscowTime(parsedDate) {
            return moment.tz(parsedDate, 'Europe/Moscow').format(); // Преобразуем и возвращаем в формате ISO
        }


// Функция для форматирования даты в "человеческий" язык
        function formatHumanReadableDate(date) {
            const options = {
                weekday: 'short',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
            };
            return date.toLocaleString('ru-RU', options);
        }

        bot.command('zoom', async (ctx) => {
            try {
                // Извлекаем текст после команды /zoom
                const messageText = ctx.message.text.replace('/zoom', '').replace('@hmns_sandbot', '').trim();
                const groupId = ctx.message.chat.id;
                const projectName = await chatController.getProjectName(groupId);
                console.log('Название проекта - ' + projectName);
                console.log('Текст запроса - ' + messageText);

                // Отправляем запрос к GPT API
                const response = await sendQuestion(projectName, messageText);
                console.log('Ответ от GPT API - ' + response);

                const obj = JSON.parse(response);
                if (!obj.success) return ctx.reply('Ошибка, загляните в консоль: ' + obj.reason);

                const duckTime = await getDuckTime(obj.data.date + ' MSK');

                // Парсинг даты с использованием chrono
                const parsedDate = chrono.parseDate(duckTime, new Date(), { forwardDate: true });

                // Конвертируем время в московское с помощью luxon
                const moscowDate = convertToMoscowTime(parsedDate);

                // Обновляем дату в объекте для отображения пользователю (в московском времени)
                obj.data.date = parsedDate;

                console.log('Объект с конечной датой - ', obj);

                // Формируем "человеческий" формат даты
                const humanReadableDate = formatHumanReadableDate(moscowDate);

                // Формируем сообщение для подтверждения встречи
                const confirmText = `
Вы хотите создать встречу в ZOOM со следующими параметрами:
- Проект: ${obj.data.project}
- Дата проведения: ${humanReadableDate}
- Описание встречи: ${obj.data.description}
- Комментарий: ${obj.data.comment}
`;
                //tse

                // Создаем клавиатуру с кнопками "Создать" и "Отменить"
                const keyboard = new InlineKeyboard()
                    .text('Создать', 'create_zoom_meeting')
                    .text('Отменить', 'cancel_zoom_meeting');

                // Отправляем сообщение с параметрами и клавиатурой
                const message = await ctx.reply(confirmText, {
                    reply_markup: keyboard
                });

                // Обрабатываем нажатие на кнопки
                bot.callbackQuery(['create_zoom_meeting', 'cancel_zoom_meeting'], async (callbackCtx) => {
                    // Проверяем какая кнопка была нажата
                    if (callbackCtx.match === 'create_zoom_meeting') {


                        // Отправляем запрос на создание встречи в Zoom
                        const createZoom = await createZoomMeeting(obj);
                        console.log('Ответ Zoom:', createZoom);

                        if (createZoom.success) {
                            // Конвертируем дату встречи в московское время
                            const meetingMoscowDate = convertToMoscowTime(new Date(createZoom.meetingDetails.start_time));

                            // Формируем "человеческий" формат даты
                            const humanMeetingDate = formatHumanReadableDate(meetingMoscowDate);

                            // Формируем сообщение с информацией о созданной встрече
                            const meetingInfo = `
Встреча успешно создана!
- Название: ${createZoom.meetingDetails.topic}
- Дата: ${humanMeetingDate}
- Комментарий: ${obj.data.comment}
- Ссылка на подключение: [Присоединиться](${createZoom.meetingDetails.join_url})
- Пароль: ${createZoom.meetingDetails.password}
`;

                            // Обновляем исходное сообщение с результатом
                            await callbackCtx.editMessageText(meetingInfo, { parse_mode: 'Markdown' });
                        } else {
                            await callbackCtx.reply('Ошибка при создании встречи: ' + createZoom.error);
                        }
                    } else if (callbackCtx.match === 'cancel_zoom_meeting') {
                        // Отмена создания встречи
                        await callbackCtx.editMessageText('Создание встречи отменено.');
                    }

                    // Закрываем инлайн-кнопки
                    await callbackCtx.answerCallbackQuery(); // Подтверждаем обработку callback
                });
            } catch (error) {
                console.error('Ошибка:', error);
                await ctx.reply('Произошла ошибка при обработке команды. Подробности в консоли.');
            }
        });



        // Обработчик команды /pin
        bot.command('pin', async (ctx) => {
            // Проверяем, является ли это сообщение ответом на другое сообщение
            if (ctx.message.reply_to_message) {
                const repliedMessage = ctx.message.reply_to_message;

                if (!repliedMessage) {
                    // Если нет ответа на сообщение, выходим
                    return ctx.reply('Ответьте на сообщение, которое нужно обработать.');
                }

                let messageText = '<Пустое сообщение>'; // Дефолтное значение

// Проверяем текстовое сообщение
                if (repliedMessage.text) {
                    messageText = repliedMessage.text;
                }
// Проверяем документ (файл)
                else if (repliedMessage.document) {
                    messageText = repliedMessage.document.file_name;
                    if (repliedMessage.caption) {
                        messageText += `: ${repliedMessage.caption}`; // Добавляем описание к файлу, если оно есть
                    }
                }
// Проверяем фото
                else if (repliedMessage.photo) {
                    messageText = '<Изображение>';
                    if (repliedMessage.caption) {
                        messageText += `: ${repliedMessage.caption}`; // Добавляем описание к изображению, если оно есть
                    }
                }
// Проверяем видео
                else if (repliedMessage.video) {
                    messageText = '<Видео>';
                    if (repliedMessage.caption) {
                        messageText += `: ${repliedMessage.caption}`; // Добавляем описание к видео, если оно есть
                    }
                }
// Проверяем аудио
                else if (repliedMessage.audio) {
                    messageText = repliedMessage.audio.file_name;
                    if (repliedMessage.caption) {
                        messageText += `: ${repliedMessage.caption}`; // Добавляем описание к аудио, если оно есть
                    }
                }
// Проверяем голосовое сообщение
                else if (repliedMessage.voice) {
                    messageText = '<Голосовое сообщение>';
                }
// Проверяем стикер
                else if (repliedMessage.sticker) {
                    messageText = `<Стикер: ${repliedMessage.sticker.emoji || ''}>`;
                }

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
                const saveToPin= await chatController.saveToPined(params, repliedMessage.chat.id);
                const chat = await Chat.findOne({chat_id:repliedMessage.chat.id});
                if(!saveToPin) {
                    await ctx.reply('Это сообщение уже добавлено в закреп ранее');
                } else {
                    await chatController.addPinnedMessage(ctx, repliedMessage.chat.id);
                    const newLink = params.link.replace(params.id.toString(), chat.main_message.toString())
                    await ctx.reply(`Сообщение <a href="${newLink}">закреплено</a>`, {parse_mode: 'HTML'});
                }





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
        bot.command('getzoom', async (ctx) => {
            // Проверяем, является ли это сообщение ответом на другое сообщение
            await getAllScheduledMeetings();
        });

        bot.command('managepin', async (ctx) => {
            const chatId = ctx.chat.id;
            const chat = await Chat.findOne({ chat_id: chatId });

            if (!chat || chat.pinned_messages.length === 0) {
                return ctx.reply('Нет сохраненных сообщений.');
            }

            const keyboard = new InlineKeyboard();
            chat.pinned_messages.forEach((msg) => {
                keyboard.text(msg.summary, `pinselect_${msg.id}`).row();
            });

            await ctx.reply('Выберите сообщение:', { reply_markup: keyboard });
        });
        bot.command('updatepin', async (ctx) => {
            const chatId = ctx.chat.id;
            await chatController.addPinnedMessage(ctx,chatId);
        });

// Обработка выбора сообщения
        bot.callbackQuery(/pinselect_(\d+)/, async (ctx) => {
            const chatId = ctx.chat.id;
            const messageId = parseInt(ctx.match[1], 10);

            const chat = await Chat.findOne({ chat_id: chatId });
            const selectedMessage = chat.pinned_messages.find((msg) => msg.id === messageId);

            if (!selectedMessage) {
                return ctx.answerCallbackQuery('Сообщение не найдено.');
            }

            const keyboard = new InlineKeyboard()
                .text('Назад', 'pinback')
                .row()
                .text('Изменить описание', `pinedit_${messageId}`)
                .row()
                .text('Удалить сообщение', `pindelete_${messageId}`);

            await ctx.editMessageText(`Вы выбрали сообщение: ${selectedMessage.summary}\n\nВыберите действие:`, { reply_markup: keyboard });
        });

// Обработка нажатия кнопки "Назад"
        bot.callbackQuery('pinback', async (ctx) => {
            const chatId = ctx.chat.id;
            const chat = await Chat.findOne({ chat_id: chatId });

            if (!chat || chat.pinned_messages.length === 0) {
                return ctx.editMessageText('Нет сохраненных сообщений.');
            }

            const keyboard = new InlineKeyboard();
            chat.pinned_messages.forEach((msg) => {
                keyboard.text(msg.summary, `pinselect_${msg.id}`).row();
            });

            await ctx.editMessageText('Выберите сообщение:', { reply_markup: keyboard });
        });

// Хранилище состояний для отслеживания ожидания ответов от конкретных пользователей
        const editMessageState = {};

// Обработка команды редактирования описания
        bot.callbackQuery(/pinedit_(\d+)/, async (ctx) => {
            const chatId = ctx.chat.id;
            const userId = ctx.from.id;
            const messageId = parseInt(ctx.match[1], 10);

            await ctx.editMessageText('Введите новое описание:');

            // Устанавливаем состояние ожидания для конкретного пользователя
            editMessageState[userId] = { chatId, messageId };

            // Устанавливаем таймер на сброс ожидания через 60 секунд (например)
            setTimeout(() => {
                delete editMessageState[userId];
            }, 60000); // 1 минута
        });

// Обработка сообщений
        bot.on('message', async (ctx) => {
            const userId = ctx.from.id;

            // Проверяем, содержит ли сообщение новый закреп
            if (ctx.message.pinned_message) {
                const pinnedMessage = ctx.message.pinned_message;
                const chatId = ctx.chat.id;
                const chat = await Chat.findOne({ chat_id: chatId });
                if(!chat) {
                    return;
                }
                const mainMessage = chat.main_message;
                const mainLink = `https://t.me/c/${String(chatId).slice(4)}/${mainMessage}`;

                // Проверяем, кто закрепил сообщение
                const userWhoPinned = ctx.from;


                // Проверяем, что это не бот закрепил сообщение
                if (userWhoPinned.id !== (await bot.api.getMe()).id) {
                    // Снимаем закреп
                    await ctx.unpinChatMessage(pinnedMessage.message_id);

                    // Отправляем уведомление пользователю
                    await ctx.reply(`Воспользуйтесь командой /pin в ответ на сообщение, чтобы закрепить его в <a href="${mainLink}">навигационном посте.</a>`, {parse_mode: 'HTML'});
                }
            }

            // Проверяем, находится ли пользователь в состоянии ожидания ответа
            if (editMessageState[userId]) {
                const { chatId, messageId } = editMessageState[userId];

                // Проверяем, что сообщение пришло из того же чата
                if (ctx.chat.id === chatId) {
                    const newSummary = ctx.message.text;

                    // Обновляем описание в базе данных
                    await Chat.updateOne(
                        { chat_id: chatId, 'pinned_messages.id': messageId },
                        { $set: { 'pinned_messages.$.summary': newSummary } }
                    );
                    await chatController.addPinnedMessage(ctx,chatId);

                    await ctx.reply('Описание успешно обновлено!');

                    // Удаляем состояние, чтобы больше не слушать другие сообщения
                    delete editMessageState[userId];
                }
            }
        });


        bot.callbackQuery(/pindelete_(\d+)/, async (ctx) => {
            const messageId = parseInt(ctx.match[1], 10);

            // Показываем предупреждение
            await ctx.answerCallbackQuery({
                text: 'Вы уверены, что хотите удалить сообщение? Нажмите еще раз для подтверждения.',
                show_alert: true,
            });

            // Обновляем callback_data для следующего этапа подтверждения
            const keyboard = new InlineKeyboard()
                .text('Да, удалить', `pinconfirm_delete_${messageId}`)
                .row()
                .text('Отмена', 'pincancel_delete');

            await ctx.editMessageText('Вы точно хотите удалить это сообщение?', {
                reply_markup: keyboard,
            });
        });

// Обработка подтверждения удаления
        bot.callbackQuery(/pinconfirm_delete_(\d+)/, async (ctx) => {
            const chatId = ctx.chat.id;
            const messageId = parseInt(ctx.match[1], 10);

            // Удаляем сообщение после подтверждения
            await Chat.updateOne(
                { chat_id: chatId },
                { $pull: { pinned_messages: { id: messageId } } }
            );
            await chatController.addPinnedMessage(ctx,chatId);

            await ctx.editMessageText('Сообщение успешно удалено.');
        });

// Обработка отмены удаления
        bot.callbackQuery('pincancel_delete', async (ctx) => {
            await ctx.answerCallbackQuery('Удаление отменено.');
            await ctx.editMessageText('Удаление было отменено.');
        });







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
