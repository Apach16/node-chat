function noop() {}

module.exports = function (io, _io, routes) {
    Object.keys(routes).forEach((route) => {
        io.on(route, noop);
    });

    return async (ctx) => {
        if (routes[ctx.event]) {
            const { event, data, socket } = ctx;
            ctx.res = await routes[ctx.event]({
                event,
                data,
                socket,
                io, // koa-socket
                _io, // socket.io
            });
        }
    };
};
