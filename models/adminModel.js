const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    admins_id: [{ type: Number, required: true, unique: true }],

});

module.exports = mongoose.model('Admin', AdminSchema);
