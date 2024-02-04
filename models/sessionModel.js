const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    chat_id: { type: Number, required: true, unique: true },
    update_id:  [{ type: Number}],
    message_id: [{ type: Number}],
    last_group: { type: Number, required: true }

});

module.exports = mongoose.model('Session', SessionSchema);
