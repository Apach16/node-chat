const IO = require('socket.io-client');

const config = require('../config/client');


const options = {
    // reconnectionDelay: 1000,
};

const socket = new IO(config.server, options);

module.exports = socket;
