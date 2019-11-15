const mkdirp = require('mkdirp');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const { exec } = require('child_process');

if (!argv.config) {
    argv.config = '.origintrail_noderc';
}

if (!argv.configDir) {
    argv.configDir = '../data/';
}

if (!argv.restore_directory) {
    argv.restore_directory = '../backup/';
}

console.log('Restore OT node...');

const configPath = argv.config.lastIndexOf('/') === -1 ? '' : argv.config.slice(0, argv.config.lastIndexOf('/'));
const configName = argv.config.slice(argv.config.lastIndexOf('/') + 1);
const configDirectory = argv.configDir.replace(/\/$/, '');
const restorePath = argv.restore_directory.replace(/\/$/, '');

console.log('Setup path variables...');

const files = ['identity.json', 'kademlia.crt', 'kademlia.key', 'houston.txt', 'system.db', '.origintrail_noderc'];
const configFile = JSON.parse(fs.readFileSync(`${restorePath}/.origintrail_noderc`));

if (!fs.existsSync(`${configPath}`)) {
    console.log(`Directory ${configPath} does not exist. Creating...`);
    mkdirp.sync(`${configPath}`);
}

if (!fs.existsSync(`${configDirectory}`)) {
    console.log(`Directory ${configDirectory} does not exist. Creating...`);
    mkdirp.sync(`${configDirectory}`);
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
            if (err) throw err;
        });
    }
}

console.log('Database import...');

if (!configFile.database.provider) {
    configFile.database.provider = 'arangodb';
}
if (!configFile.database.database) {
    configFile.database.database = 'origintrail';
}

switch (configFile.database.provider) {
case 'arangodb':
    exec(
        `arangorestore --server.database ${configFile.database.database} --server.username ${configFile.database.username} --server.password ${configFile.database.password === '' ? '\'\'' : configFile.database.password} --input-directory '${restorePath}/arangodb/' --overwrite true`,
        (error, stdout, stderr) => {
            console.log(`${stdout}`);
            if (error !== null) {
                console.log(`Error: ${error}`);
            } else {
                console.log('Restore finished.');
            }
        },
    );
    break;
default:
}
