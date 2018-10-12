const socket = require('./socket');

socket.on('connect', async () => {
    console.log('connected');
    await register('test', 'test');

    await login('test', 'test');

    await sendMessage('5bbcbe71cee8625b25e46301', 'text', 'message to group');
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
    const [err, res] = await fetch('register', {
        username,
        password,
    });
    console.log('register err:', err, 'res', res);
}

async function login(username, password) {
    const [err, res] = await fetch('login', {
        username,
        password,
    });
    if (err) {
        console.log('login error:', err);
        return;
    }
    console.log('login response:', res);
}

async function sendMessage(to, type, content) {
    const [err, res] = await fetch('sendMessage', {
        to,
        type,
        content,
    });
    if (err) {
        console.log('sendMessage error:', err);
        return;
    }
    console.log('sendMessage: response', res);
}
