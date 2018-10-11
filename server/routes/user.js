const assert = require('assert');
const { isValid } = require('mongoose').Types.ObjectId;

const User = require('../models/user');
const Friend = require('../models/friend');

module.exports = {
    async changeAvatar(ctx) {
        const { avatar } = ctx.data;
        assert(avatar, 'invalid avatar');

        await User.update({ _id: ctx.socket.user }, {
            avatar,
        });

        return {};
    },

    async addFriend(ctx) {
        const { userId } = ctx.data;
        assert(isValid(userId), 'userId');

        const user = await User.findOne({ _id: userId });
        assert(user, 'user');

        const friend = await Friend.find({ from: ctx.socket.user, to: user._id });
        assert(friend.length === 0, 'friend');

        const newFriend = await Friend.create({
            from: ctx.socket.user,
            to: user._id,
        });

        return {
            _id: user._id,
            username: user.username,
            avatar: user.avatar,
            from: newFriend.from,
            to: newFriend.to,
        };
    },

    async deleteFriend(ctx) {
        const { userId } = ctx.data;
        assert(isValid(userId), 'userId');

        const user = await User.findOne({ _id: userId });
        assert(user, 'user');

        await Friend.remove({ from: ctx.socket.user, to: user._id });
        return {};
    },
};
