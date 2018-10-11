const IO = require('socket.io-client');

const config = require('../config/client');

const options = {
    // reconnectionDelay: 1000,
};

const socket = new IO(config.server, options);

socket.on('connect', async () => {
    // TODO: client logic here
    const username = 'test';
    const password = '123456';
    await register(username, password);
});

socket.on('disconnect', () => {
    console.log('disconnected');
});

function fetch(event, data = {}) {
    return new Promise((resolve) => {
        socket.emit(event, data, (res) => {
            if (typeof res === 'string') {
                resolve([res, null]);
            } else {
                resolve([null, res]);
            }
        });
    });
}

async function register(username, password) {
    try {
        const [err, res] = await fetch('register', {
            username,
            password,
        });
        console.log('err', err, 'res', res);
    } catch (err) {
        console.log('err', err);
    }
}

module.exports = socket;
