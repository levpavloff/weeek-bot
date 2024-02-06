require('dotenv').config();
const express = require('express');
const router = express.Router();
const Chat = require('../models/chatModel');
const chatController = require('../controllers/chatController');
const tasksService = require('../services/tasksService');
const webAppController = require('../controllers/webAppController');
const axios = require('axios');
const {json} = require("express");
const { Telegraf } = require('telegraf');

const botToken = process.env.BOT_TOKEN;


async function checkTgAdmins(chatId, userId) {
   try {
      const apiUrl = `https://api.telegram.org/bot${botToken}/getChatAdministrators?chat_id=${chatId}`;
      const response = await axios.get(apiUrl);
      console.log(response.data.result);
      const adminsId = response.data.result.map(admin => {
         return admin.user.id;
      })
      await Chat.updateOne({chat_id: chatId}, {$set: {users: adminsId}});
      return !!adminsId.includes(userId);

   } catch (error) {
      // Обработка ошибок отправки
      console.error('Ошибка прямого запроса админов группы', error);
   }
}


const errorAccess = {
   access: false,
   code: 403,
   project: null
}

const acceptAccess = {
   access: true,
   code: 200,
   project: null,
   id: null,
   tasks: []
}

// Здесь вы определяете маршруты API
router.get('/bot/get-tasks', async (req, res) => {
   const {user , chat} = req.query;
   if(!user || !chat) {
      console.log('Нет параметра');
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(errorAccess);
   }
   try {
      console.log(`Чат ${chat}, юзер ${user}`);
      const isAdmin = await checkTgAdmins(chat, user);
      const chatBD = await Chat.findOne({chat_id: chat});
      if(!chatBD) {
         console.log(`Нет чата`);
         res.setHeader('Content-Type', 'application/json');
         res.status(200).json(errorAccess);
      }
      if(!chatBD.users.includes(user) || !isAdmin) {
         console.log(`Не админ`);
         res.setHeader('Content-Type', 'application/json');
         res.status(200).json(errorAccess);
      }
      acceptAccess.project = chatBD.project.name;
      acceptAccess.id = chatBD.project.id;
      acceptAccess.user = user;
      acceptAccess.chat = chat;
      acceptAccess.tasks = await tasksService.getTasks(chatBD.project.id);
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(acceptAccess);
   } catch (err) {
      console.log(err)
   }

});


router.post('/bot/create-task', async (req, res) => {
   const dataFromBody = req.body;
   const {project} = req.query;
   const task = await webAppController.prepareTask(dataFromBody, project);
   const createTask = await tasksService.createTask(task);
   if(createTask.success){
   await chatController.sendResMsg(project, createTask.task)
   }

   res.send(createTask);

})

// Экспортируем router, чтобы использовать его в app.js
module.exports = router;
