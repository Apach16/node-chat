module.exports = function () {
    const noUseLoginEvent = {
        register: true,
        login: true,
        loginByToken: true,
    };
    return async (ctx, next) => {
        if (!noUseLoginEvent[ctx.event] && !ctx.socket.user) {
            ctx.res = 'unauthenticated';
            return;
        }
        await next();
    };
};
