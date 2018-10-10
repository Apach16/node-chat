const MB = 1024 * 1024;

module.exports = {
    server: process.env.NODE_ENV === 'development' ? 'ws://localhost:9200' : '',

    maxImageSize: MB * 3,
    maxBackgroundImageSize: MB * 5,
    maxAvatarSize: MB * 1.5,

    // client default system setting
    primaryColor: '74, 144, 226',
    primaryTextColor: '247, 247, 247',
    sound: 'default',
};
