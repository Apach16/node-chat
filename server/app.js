const Koa = require('koa');
const IO = require('koa-socket');
const koaSend = require('koa-send');
const koaStatic = require('koa-static');
const path = require('path');
const mount = require('koa-mount');

const enhanceContext = require('./middlewares/enhanceContext.js');
const log = require('./middlewares/log');
const catchError = require('./middlewares/catchError');
const seal = require('./middlewares/seal');
const frequency = require('./middlewares/frequency');
const isLogin = require('./middlewares/isLogin');
const route = require('./middlewares/route');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const groupRoutes = require('./routes/group');
const messageRoutes = require('./routes/message');
const systemRoutes = require('./routes/system');

const Socket = require('./models/socket');

const config = require('../config/server');

const app = new Koa();

app.use(async (ctx, next) => {
    console.log(ctx.request.url);
    if (!/\//.test(ctx.request.url)) {
        await koaSend(
            ctx,
            'index.html',
            {
                root: path.join(__dirname, '../public'),
                maxage: 1000 * 60 * 60 * 24 * 7,
                gzip: true,
            } // eslint-disable-line
        );
    } else {
        await next();
    }
});


// static files
app.use(koaStatic(
    path.join(__dirname, '../public'),
    {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        gzip: true,
    } // eslint-disable-line
));

// docs files
app.use(koaStatic(
    path.join(__dirname, '../public/docs'),
    {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        gzip: true,
    } // eslint-disable-line
));

// documentation
app.use(mount('/docs', async (ctx) => {
    await koaSend(
        ctx,
        'index.html',
        {
            root: path.join(__dirname, '../public/docs'),
            maxage: 1000 * 60 * 60 * 24 * 7,
            gzip: true,
        } // eslint-disable-line
    );
}));

const io = new IO({
    ioOptions: {
        pingTimeout: 10000,
        pingInterval: 5000,
    },
});

// bind sockets to server
io.attach(app);

if (process.env.NODE_ENV === 'production' && config.allowOrigin) {
    app._io.origins(config.allowOrigin);
}

// custom middleware
io.use(enhanceContext());
io.use(log());
io.use(catchError());
io.use(seal());
io.use(frequency());
io.use(isLogin());
io.use(route(
    app.io,
    app._io,
    Object.assign({}, authRoutes, userRoutes, groupRoutes, messageRoutes, systemRoutes),
));

app.io.on('connection', async (ctx) => {
    console.log(`  <<<< connection ${ctx.socket.id} ${ctx.socket.request.connection.remoteAddress}`);
    await Socket.create({
        id: ctx.socket.id,
        ip: ctx.socket.request.connection.remoteAddress,
    });
});
app.io.on('disconnect', async (ctx) => {
    console.log(`  >>>> disconnect ${ctx.socket.id}`);
    await Socket.remove({
        id: ctx.socket.id,
    });
});

module.exports = app;
