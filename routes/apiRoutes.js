// apiRoutes.js
const express = require('express');
const router = express.Router();
const Chat = require('../models/chatModel');
const chatController = require('../controllers/chatController');
const tasksService = require('../services/tasksService');
const webAppController = require('../controllers/webAppController');
const {json} = require("express");
const { Telegraf } = require('telegraf');




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
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(errorAccess);
   }
   try {
      const chatBD = await Chat.findOne({chat_id: chat});
      if(!chatBD) {
         res.setHeader('Content-Type', 'application/json');
         res.status(200).json(errorAccess);
      }
      if(!chatBD.users.includes(user)) {
         res.setHeader('Content-Type', 'application/json');
         res.status(200).json(errorAccess);
      }
      acceptAccess.project = chatBD.project.name;
      acceptAccess.id = chatBD.project.id;
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
