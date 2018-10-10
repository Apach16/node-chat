const assert = require('assert');
const bluebird = require('bluebird');
const bcrypt = bluebird.promisifyAll(require('bcrypt'), { suffix: '$' });
const jwt = require('jwt-simple');
const { isValid } = require('mongoose').Types.ObjectId;

const User = require('../models/user');
const Group = require('../models/group');
const Socket = require('../models/socket');
const Friend = require('../models/friend');
const Message = require('../models/message');
const config = require('../../config/server');
const getRandomAvatar = require('../../utils/getRandomAvatar');

const saltRounds = 10;

const OneDay = 1000 * 60 * 60 * 24;

function generateToken(user, environment) {
    return jwt.encode(
        {
            user,
            environment,
            expires: Date.now() + config.tokenExpiresTime,
        },
        config.jwtSecret,
    );
}

function handleNewUser(user) {
    if (Date.now() - user.createTime.getTime() < OneDay) {
        const newUserList = global.mdb.get('newUserList');
        newUserList.add(user._id.toString());
        setTimeout(() => {
            newUserList.delete(user._id.toString());
        }, OneDay);
    }
}

module.exports = {
    async register(ctx) {
        const {
            username, password, os, browser, environment,
        } = ctx.data;
        assert(username, 'username');
        assert(password, 'password');

        const user = await User.findOne({ username });
        assert(!user, 'user');

        const defaultGroup = await Group.findOne({ isDefault: true });
        assert(defaultGroup, 'defaultGroup');

        const salt = await bcrypt.genSalt$(saltRounds);
        const hash = await bcrypt.hash$(password, salt);

        let newUser = null;
        try {
            newUser = await User.create({
                username,
                salt,
                password: hash,
                avatar: getRandomAvatar(),
            });
        } catch (err) {
            if (err.name === 'ValidationError') {
                return 'validation error';
            }
            throw err;
        }

        handleNewUser(newUser);

        defaultGroup.members.push(newUser);
        await defaultGroup.save();

        const token = generateToken(newUser._id, environment);

        ctx.socket.user = newUser._id;
        await Socket.update({ id: ctx.socket.id }, {
            user: newUser._id,
            os,
            browser,
            environment,
        });

        return {
            _id: newUser._id,
            avatar: newUser.avatar,
            username: newUser.username,
            groups: [{
                _id: defaultGroup._id,
                name: defaultGroup.name,
                avatar: defaultGroup.avatar,
                creator: defaultGroup.creator,
                createTime: defaultGroup.createTime,
                messages: [],
            }],
            friends: [],
            token,
            isAdmin: false,
        };
    },
    async login(ctx) {
        assert(!ctx.socket.user, 'user');

        const {
            username, password, os, browser, environment,
        } = ctx.data;
        assert(username, 'username');
        assert(password, 'password');

        const user = await User.findOne({ username });
        assert(user, 'user');

        const isPasswordCorrect = bcrypt.compareSync(password, user.password);
        assert(isPasswordCorrect, 'incorrect password');

        handleNewUser(user);

        user.lastLoginTime = Date.now();
        await user.save();

        const groups = await Group.find({ members: user }, { _id: 1, name: 1, avatar: 1, creator: 1, createTime: 1 });
        groups.forEach((group) => {
            ctx.socket.socket.join(group._id);
        });

        const friends = await Friend
            .find({ from: user._id })
            .populate('to', { avatar: 1, username: 1 });

        const token = generateToken(user._id, environment);

        ctx.socket.user = user._id;
        await Socket.update({ id: ctx.socket.id }, {
            user: user._id,
            os,
            browser,
            environment,
        });

        return {
            _id: user._id,
            avatar: user.avatar,
            username: user.username,
            groups,
            friends,
            token,
            isAdmin: user._id.toString() === config.administrator,
        };
    },
    async loginByToken(ctx) {
        assert(!ctx.socket.user, 'user');

        const {
            token, os, browser, environment,
        } = ctx.data;
        assert(token, 'token');

        let payload = null;
        try {
            payload = jwt.decode(token, config.jwtSecret);
        } catch (err) {
            return 'invalid token';
        }

        assert(Date.now() < payload.expires, 'token expires');
        assert.equal(environment, payload.environment, 'invalid environment');

        const user = await User.findOne({ _id: payload.user }, { _id: 1, avatar: 1, username: 1, createTime: 1 });
        assert(user, 'user not found');

        handleNewUser(user);

        user.lastLoginTime = Date.now();
        await user.save();

        const groups = await Group.find({ members: user }, { _id: 1, name: 1, avatar: 1, creator: 1, createTime: 1 });
        groups.forEach((group) => {
            ctx.socket.socket.join(group._id);
        });

        const friends = await Friend
            .find({ from: user._id })
            .populate('to', { avatar: 1, username: 1 });

        ctx.socket.user = user._id;
        await Socket.update({ id: ctx.socket.id }, {
            user: user._id,
            os,
            browser,
            environment,
        });

        return {
            _id: user._id,
            avatar: user.avatar,
            username: user.username,
            groups,
            friends,
            isAdmin: user._id.toString() === config.administrator,
        };
    },

    async guest(ctx) {
        const { os, browser, environment } = ctx.data;

        await Socket.update({ id: ctx.socket.id }, {
            os,
            browser,
            environment,
        });

        const group = await Group.findOne({ isDefault: true }, { _id: 1, name: 1, avatar: 1, createTime: 1 });
        ctx.socket.socket.join(group._id);

        const messages = await Message
            .find(
                { to: group._id },
                { type: 1, content: 1, from: 1, createTime: 1 },
                { sort: { createTime: -1 }, limit: 15 },
            )
            .populate('from', { username: 1, avatar: 1 });
        messages.reverse();

        return Object.assign({ messages }, group.toObject());
    },

    async changeAvatar(ctx) {
        const { avatar } = ctx.data;
        assert(avatar, 'avatar');

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

    async changePassword(ctx) {
        const { oldPassword, newPassword } = ctx.data;
        assert(newPassword, 'newPassword');
        assert(oldPassword !== newPassword, 'oldPassword');

        const user = await User.findOne({ _id: ctx.socket.user });
        const isPasswordCorrect = bcrypt.compareSync(oldPassword, user.password);
        assert(isPasswordCorrect, 'isPasswordCorrect');

        const salt = await bcrypt.genSalt$(saltRounds);
        const hash = await bcrypt.hash$(newPassword, salt);

        user.password = hash;
        await user.save();

        return {
            msg: 'ok',
        };
    },
};
