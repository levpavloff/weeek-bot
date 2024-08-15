const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    chat_id: { type: Number, required: true, unique: true },
    update_id:  [{ type: Number, required: true}],
    project: {
        id: String,
        name: String,
        boards: [{
            id: String,
            name: String,
        }],
    },
    users: [String],
    main_message: { type: Number, default: 0 },
    pinned_messages: [{id: Number, link: String, message: String, author: String, date: Date, summary: String, username: String}],
    events: [{title: String, date: Date, zoom_link: String, zoom_id: String, subscribers: String, description: String, comments: String}],
});

module.exports = mongoose.model('Chat', ChatSchema);
