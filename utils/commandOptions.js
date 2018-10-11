const commandLineArgs = require('command-line-args');

const optionDefinitions = [
    { name: 'database', type: String },
    { name: 'jwtSecret', type: String },
    { name: 'allowOrigin', type: String, multiple: true },
    { name: 'publicPath', type: String },
    { name: 'subDirectory', type: String },
    { name: 'port', type: Number },
    { name: 'administrator', type: String },
];
module.exports = commandLineArgs(optionDefinitions);
