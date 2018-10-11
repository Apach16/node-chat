const mongoose = require('mongoose');

const { Schema } = mongoose;

const SocketSchema = new Schema({
    createTime: { type: Date, default: Date.now },

    id: {
        type: String,
        unique: true,
        index: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    ip: {
        type: String,
    },
});

const Socket = mongoose.model('Socket', SocketSchema);
module.exports = Socket;
