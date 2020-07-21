const mkdirp = require('mkdirp');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const { exec } = require('child_process');
const path = require('path');
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

if (!argv.config) {
    argv.config = '.origintrail_noderc';
}

if (!argv.configDir) {
    argv.configDir = '../data/';
}

if (!argv.certs) {
    argv.certs = '../certs/';
}

if (!argv.restore_directory) {
    argv.restore_directory = '../backup/';
}

console.log('Restore OT node...');

const configPath = argv.config.lastIndexOf('/') === -1 ? '' : argv.config.slice(0, argv.config.lastIndexOf('/'));
const configName = argv.config.slice(argv.config.lastIndexOf('/') + 1);
const configDirectory = argv.configDir.replace(/\/$/, '');
const certsDirectory = argv.certs.replace(/\/$/, '');
const restorePath = argv.restore_directory.replace(/\/$/, '');

console.log('Setup path variables...');

const files = ['identity.json', 'kademlia.crt', 'kademlia.key', 'houston.txt', 'system.db', 'erc725_identity.json', configName];
const certs = ['fullchain.pem', 'privkey.pem'];

const configFile = JSON.parse(fs.readFileSync(`${restorePath}/.origintrail_noderc`));

if (!fs.existsSync(`${configPath}`)) {
    console.log(`Directory ${configPath} does not exist. Creating...`);
    mkdirp.sync(`${configPath}`);
}

if (!fs.existsSync(`${configDirectory}`)) {
    console.log(`Directory ${configDirectory} does not exist. Creating...`);
    mkdirp.sync(`${configDirectory}`);
}

if (!fs.existsSync(`${certsDirectory}`)) {
    console.log(`Directory ${certsDirectory} does not exist. Creating...`);
    mkdirp.sync(`${certsDirectory}`);
}

for (const file of files) {
    const src = `${restorePath}/${file}`;
    let dest = `${configDirectory}/${file}`;
    if (file === '.origintrail_noderc') {
        if (configPath !== '') {
            dest = `${configPath}/${configName}`;
        } else {
            dest = `${configName}`;
        }
    }
    if (fs.existsSync(src)) {
        console.log(`Restore: ${src} -> ${dest}`);
        fs.copyFileSync(src, dest, (err) => {
            if (err) {
                console.error(err);
                return 1;
            }
        });
    }
}

for (const cert of certs) {
    const src = `${restorePath}/${cert}`;
    const dest = `${certsDirectory}/${cert}`;

    if (fs.existsSync(src)) {
        console.log(`Restore: ${src} -> ${dest}`);
        fs.copyFileSync(src, dest, (err) => {
            if (err) {
                console.error(err);
                return 1;
            }
        });
    }
}

console.log('Database import...');

if (!configFile.database) {
    configFile.database = defaultConfig.database;
}
if (!configFile.database.provider) {
    configFile.database.provider = defaultConfig.database.provider;
}
if (!configFile.database.username) {
    configFile.database.username = defaultConfig.database.username;
}

if (configFile.database.password_file_name) {
// eslint-disable-next-line max-len
    const databasePasswordFilePath = path.join(configDirectory, configFile.database.password_file_name);
    if (fs.existsSync(databasePasswordFilePath)) {
        console.log('Using existing graph database password.');
        configFile.database.password = fs.readFileSync(databasePasswordFilePath).toString();
    } else {
        console.log('================================================================');
        console.log('          Using default database password for access            ');
        console.log('================================================================');
    }
}

switch (configFile.database.provider) {
case 'arangodb':
    exec(
        `arangorestore --server.database ${configFile.database.database} --server.username ${configFile.database.username} --server.password ${configFile.database.password === '' ? '\'\'' : configFile.database.password} --input-directory '${restorePath}/arangodb/' --overwrite true`,
        (error, stdout, stderr) => {
            console.log(`${stdout}`);
            if (error !== null) {
                console.error(`${error}`);
                return 1;
            }
            console.log('Restore finished.');
        },
    );
    break;
default:
}

return 0;
