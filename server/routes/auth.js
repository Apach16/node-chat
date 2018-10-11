const assert = require('assert');
const bluebird = require('bluebird');
const bcrypt = bluebird.promisifyAll(require('bcrypt'), { suffix: '$' });
const jwt = require('jwt-simple');

const User = require('../models/user');
const Socket = require('../models/socket');
const Group = require('../models/group');
const Friend = require('../models/friend');
const getRandomAvatar = require('../../utils/getRandomAvatar');
const config = require('../../config/server');

const saltRounds = 10;

const OneDay = 1000 * 60 * 60 * 24;

function generateToken(user) {
    return jwt.encode(
        {
            user,
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
            username, password,
        } = ctx.data;
        assert(username, 'username');
        assert(password, 'password');

        const user = await User.findOne({ username });
        assert(!user, 'user');

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

        const token = generateToken(newUser._id);

        ctx.socket.user = newUser._id;
        await Socket.update({ id: ctx.socket.id }, {
            user: newUser._id,
        });

        return {
            _id: newUser._id,
            avatar: newUser.avatar,
            username: newUser.username,
            groups: [],
            friends: [],
            token,
            isAdmin: false,
        };
    },

    async login(ctx) {
        assert(!ctx.socket.user, 'user');

        const {
            username, password,
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

        const token = generateToken(user._id);

        ctx.socket.user = user._id;
        await Socket.update({ id: ctx.socket.id }, {
            user: user._id,
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
        assert(!ctx.socket.user, 'user not found');

        const { token } = ctx.data;
        assert(token, 'token not found');

        let payload = null;
        try {
            payload = jwt.decode(token, config.jwtSecret);
        } catch (err) {
            return 'invalid jwt token';
        }

        assert(Date.now() < payload.expires, 'token is expired');

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
