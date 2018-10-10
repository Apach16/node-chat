const IO = require('socket.io-client');

const config = require('../config/client');

const options = {
  // reconnectionDelay: 1000,
};
const socket = new IO(config.server, options);
console.log('server', config.server)

socket.on('connect', async () => {
  const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiNWJiZTFlOTY4NmFjYTM0YzU2ZGI5Nzk1IiwiZXhwaXJlcyI6MTUzOTc5MTEyNzAwOH0.KaBVEIJwt7MAU9aL9_-maEZv5R6kRzhyKWthdKh_XyY';
  if (token) {
    const [err, res] = await fetch('loginByToken', {
      token,
      os: 'os name',
      browser: 'browser name'
    }, { toast: false });
    if (err) {
      guest();
    } 
    console.log('res1', res)
  } else {
    guest();
  }
});

socket.on('disconnect', () => {
  console.log('disconnected');
});

async function guest() {
  const [err, res] = await fetch('guest', {
    os: 'os',
    browser: 'browser',
    environment: 'env',
  });
  if (err) {
    console.log('guest error', err)
  } else {
    console.log('connected as guest')
  }
}

function fetch(event, data = {}, {
  toast = true,
} = {}) {
  return new Promise((resolve) => {
    socket.emit(event, data, (res) => {
      if (typeof res === 'string') {
        if (toast) {
          console.log('error', res);
        }
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
      username: 'test',
      password: 'test'
    })
    console.log('err', err, 'res', res)
  } catch (err) {
    console.log('err', err)
  }
}



module.exports = socket;
