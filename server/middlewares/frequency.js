const MaxCallPerMinutes = 20;
/**
 * Limiting the frequency of interface calls
 */
module.exports = function () {
    let callTimes = {};
    setInterval(() => callTimes = {}, 60000); // Emptying every 60 seconds

    return async (ctx, next) => {
        const { user } = ctx.socket;

        const newUserList = global.mdb.get('newUserList');
        const socketId = ctx.socket.id;
        const count = callTimes[socketId] || 0;

        if (user && newUserList.has(user.toString()) && count > 5) {
            return ctx.res = 'new users can not make more than 5 calls per minute';
        }

        if (count > MaxCallPerMinutes) {
            return ctx.res = 'max call per minutes reached';
        }
        callTimes[socketId] = count + 1;
        await next();
    };
};
