const mkdirp = require('mkdirp');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const { exec } = require('child_process');
require('dotenv').config();

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'testnet';
} else if (['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) < 0) {
    console.error(`Unsupported environment '${process.env.NODE_ENV}'`);
    return 1;
}

const configjson = require('../config/config.json');

const defaultConfig = configjson[process.env.NODE_ENV];

const timestamp = new Date().toISOString();

if (!argv.config) {
    argv.config = '.origintrail_noderc';
}

if (!argv.configDir) {
    argv.configDir = '../data/';
}

if (!argv.certs) {
    argv.certs = '../certs/';
}

if (!argv.backup_directory) {
    argv.backup_directory = '../backup/';
}

console.log('Backup OT node...');

const configPath = argv.config.lastIndexOf('/') === -1 ? '' : argv.config.slice(0, argv.config.lastIndexOf('/'));
const configName = argv.config.slice(argv.config.lastIndexOf('/') + 1);
const configDirectory = argv.configDir.replace(/\/$/, '');
const certsDirectory = argv.certs.replace(/\/$/, '');
const backupPath = argv.backup_directory.replace(/\/$/, '');

console.log('Setup path variables...');

const files = ['identity.json', 'kademlia.crt', 'kademlia.key', 'houston.txt', 'system.db', 'erc725_identity.json', configName];
const certs = ['fullchain.pem', 'privkey.pem'];

let configFile;
if (configPath !== '') {
    configFile = JSON.parse(fs.readFileSync(`${configPath}/${configName}`));
} else {
    configFile = JSON.parse(fs.readFileSync(`${configName}`));
}

if (fs.existsSync(`${backupPath}/${timestamp}`)) {
    fs.rmdirSync(`${backupPath}/${timestamp}`);
    console.log(`Directory ${backupPath}/${timestamp} already exists. Removing...`);
}

console.log(`Creating ${backupPath}/${timestamp} directories...`);
mkdirp.sync(`${backupPath}/${timestamp}`, (err) => { if (err) { console.error(err); return 1; } });

for (const file of files) {
    let src = `${configDirectory}/${file}`;
    let dest = `${backupPath}/${timestamp}/${file}`;
    if (file === configName) {
        if (configPath !== '') {
            src = `${configPath}/${file}`;
        } else {
            src = `${file}`;
        }
        dest = `${backupPath}/${timestamp}/.origintrail_noderc`;
    }

    if (fs.existsSync(src)) {
        console.log(`Backup: ${src} -> ${dest}`);
        fs.copyFileSync(src, dest, (err) => { if (err) { console.error(err); return 1; } });
    }
}

for (const cert of certs) {
    const src = `${certsDirectory}/${cert}`;
    const dest = `${backupPath}/${timestamp}/${cert}`;

    if (fs.existsSync(src)) {
        console.log(`Backup: ${src} -> ${dest}`);
        fs.copyFileSync(src, dest, (err) => { if (err) { console.error(err); return 1; } });
    }
}

console.log('Database export...');

if (!configFile.database) {
    configFile.database = defaultConfig.database;
}
if (!configFile.database.provider) {
    configFile.database.provider = defaultConfig.database.provider;
}
if (!configFile.database.username) {
    configFile.database.username = defaultConfig.database.username;
}
if (configFile.database.password === undefined) {
    configFile.database.password = defaultConfig.database.password;
}

switch (configFile.database.provider) {
case 'arangodb':
    exec(
        `arangodump --server.database ${configFile.database.database} --server.username ${configFile.database.username} --server.password ${configFile.database.password === '' ? '\'\'' : configFile.database.password} --output-directory '${backupPath}/${timestamp}/arangodb' --overwrite true`,
        (error, stdout, stderr) => {
            console.log(`${stdout}`);
            if (error !== null) {
                console.error(`${error}`);
                return 1;
            }
            console.log('Backup finished.');
        },
    );
    break;
default:
    break;
}

return 0;
