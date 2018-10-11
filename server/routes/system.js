const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'), { suffix: '$' });
const path = require('path');
const assert = require('assert');
const ip = require('ip');
const User = require('../models/user');
const Group = require('../models/group');
const config = require('../../config/server');

module.exports = {
    async search(ctx) {
        const { keywords } = ctx.data;
        if (keywords === '') {
            return {
                users: [],
                groups: [],
            };
        }

        const users = await User.find(
            { username: { $regex: keywords } },
            { avatar: 1, username: 1 },
        );
        const groups = await Group.find(
            { name: { $regex: keywords } },
            { avatar: 1, name: 1, members: 1 },
        );

        return {
            users,
            groups: groups.map(group => ({
                _id: group._id,
                avatar: group.avatar,
                name: group.name,
                members: group.members.length,
            })),
        };
    },
    async sealUser(ctx) {
        assert(ctx.socket.user.toString() === config.administrator, 'not admin');

        const { username } = ctx.data;
        assert(username !== '', 'invalid username');

        const user = await User.findOne({ username });
        assert(user, 'user not found');

        const userId = user._id.toString();
        const sealList = global.mdb.get('sealList');
        assert(!sealList.has(userId), 'user already sealed');

        sealList.add(userId);
        setTimeout(() => {
            sealList.delete(userId);
        }, 1000 * 60 * 10);

        return {
            msg: 'ok',
        };
    },
    async getSealList(ctx) {
        assert(ctx.socket.user.toString() === config.administrator, 'not admin');

        const sealList = global.mdb.get('sealList');
        const userIds = [...sealList.keys()];
        const users = await User.find({ _id: { $in: userIds } });
        const result = users.map(user => user.username);
        return result;
    },
    async uploadFile(ctx) {
        try {
            await fs.writeFile$(path.resolve(__dirname, `../../public/${ctx.data.fileName}`), ctx.data.file);
            return {
                url: `${process.env.NODE_ENV === 'production' ? '' : `http://${ip.address()}:${config.port}`}/${ctx.data.fileName}`,
            };
        } catch (err) {
            console.error(err);
            return `error:${err.message}`;
        }
    },
};
