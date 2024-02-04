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
    users: [String]
});

module.exports = mongoose.model('Chat', ChatSchema);
