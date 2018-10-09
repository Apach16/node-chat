const mongoose = require('mongoose');

const app = require('./app');
const config = require('../config/server');

const Socket = require('./models/socket');
const Group = require('./models/group');
const getRandomAvatar = require('../utils/getRandomAvatar');

global.mdb = new Map();
global.mdb.set('sealList', new Set());
global.mdb.set('newUserList', new Set());

mongoose.Promise = Promise;


mongoose.connect(config.database, async (err) => {
    if (err) {
        console.error('connect database error!');
        console.error(err);
        return process.exit(1);
    }

    const group = await Group.findOne({ isDefault: true });
    if (!group) {
        const defaultGroup = await Group.create({
            name: config.defaultGroupName,
            avatar: getRandomAvatar(),
            isDefault: true,
        });
        if (!defaultGroup) {
            console.error('create default group fail');
            return process.exit(1);
        }
    }

    app.listen(config.port, async () => {
        await Socket.remove({});
        console.log(` >>> server listen on http://localhost:${config.port}`);
    });
});
