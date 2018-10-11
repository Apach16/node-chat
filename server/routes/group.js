const assert = require('assert');
const { isValid } = require('mongoose').Types.ObjectId;

const Group = require('../models/group');
const Socket = require('../models/socket');
const Message = require('../models/message');
const config = require('../../config/server');
const getRandomAvatar = require('../../utils/getRandomAvatar');

async function getGroupOnlineMembers(group) {
    const sockets = await Socket
        .find(
            { user: group.members },
            { os: 1, browser: 1, environment: 1, user: 1 },
        )
        .populate(
            'user',
            { username: 1, avatar: 1 },
        );
    const filterSockets = sockets.reduce((result, socket) => {
        result[socket.user] = socket;
        return result;
    }, {});
    return Object.values(filterSockets);
}

module.exports = {
    async createGroup(ctx) {
        const ownGroupCount = await Group.count({ creator: ctx.socket.user });
        assert(ownGroupCount < config.maxGroupsCount, `you can not create more than ${config.maxGroupsCount} groups`);

        const { name } = ctx.data;
        assert(name, 'invalid group name');

        const group = await Group.findOne({ name });
        assert(!group, 'group already exists');

        let newGroup = null;
        try {
            newGroup = await Group.create({
                name,
                avatar: getRandomAvatar(),
                creator: ctx.socket.user,
                members: [ctx.socket.user],
            });
        } catch (err) {
            if (err.name === 'ValidationError') {
                return 'validation error';
            }
            throw err;
        }

        ctx.socket.socket.join(newGroup._id);
        return {
            _id: newGroup._id,
            name: newGroup.name,
            avatar: newGroup.avatar,
            createTime: newGroup.createTime,
            creator: newGroup.creator,
        };
    },
    async joinGroup(ctx) {
        const { groupId } = ctx.data;
        assert(isValid(groupId), 'group id is invalid');

        const group = await Group.findOne({ _id: groupId });
        assert(group, 'group not found');
        assert(group.members.indexOf(ctx.socket.user) === -1, 'user already in group');

        group.members.push(ctx.socket.user);
        await group.save();

        const messages = await Message
            .find(
                { toGroup: groupId },
                { type: 1, content: 1, from: 1, createTime: 1 },
                { sort: { createTime: -1 }, limit: 3 },
            )
            .populate('from', { username: 1, avatar: 1 });
        messages.reverse();

        ctx.socket.socket.join(group._id);

        return {
            _id: group._id,
            name: group.name,
            avatar: group.avatar,
            createTime: group.createTime,
            creator: group.creator,
            messages,
        };
    },
    async leaveGroup(ctx) {
        const { groupId } = ctx.data;
        assert(isValid(groupId), 'invalid group id');

        const group = await Group.findOne({ _id: groupId });
        assert(group, 'group not found');

        // check group creator
        if (group.creator) {
            assert(group.creator.toString() !== ctx.socket.user.toString(), 'cannot leave own group');
        }

        const index = group.members.indexOf(ctx.socket.user);
        assert(index !== -1, 'cannot leave this group');

        group.members.splice(index, 1);
        await group.save();

        ctx.socket.socket.leave(group._id);

        return {};
    },

    async getGroupOnlineMembers(ctx) {
        const { groupId } = ctx.data;
        assert(isValid(groupId), 'invalid group id');

        const group = await Group.findOne({ _id: groupId });
        assert(group, 'group not found');
        return getGroupOnlineMembers(group);
    },

    async changeGroupAvatar(ctx) {
        const { groupId, avatar } = ctx.data;
        assert(isValid(groupId), 'invalid group id');
        assert(avatar, 'invalid avatar');

        await Group.update({ _id: groupId }, { avatar });
        return {};
    },
};
