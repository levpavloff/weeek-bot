const mongoose = require('mongoose');

const LinkSchema = new mongoose.Schema({
    "url": String,
    "text": String
});

module.exports = mongoose.model('Link', LinkSchema);
