const mkdirp = require('mkdirp');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const { exec } = require('child_process');

if (!argv.config) {
    throw Error('Please provide config parameter');
}

if (!argv.restore_directory) {
    throw Error('Please provide backup_directory parameter');
}

console.log('Restore OT node...');

const configPath = argv.config.slice(0, argv.config.lastIndexOf('/'));
const configName = argv.config.slice(argv.config.lastIndexOf('/') + 1);
const configDirectory = `${configName.split('.').slice(0, -1).join('.')}-config`;
const databaseDirectory = `${configName.split('.').slice(0, -1).join('.')}-database`;
const restorePath = argv.restore_directory.replace(/\/$/, '');

console.log('Setup path variables...');

const files = ['identity.json', 'kademlia.crt', 'kademlia.key', 'houston.txt', 'system.db', configName];
const configFile = JSON.parse(fs.readFileSync(`${configPath}/${configName}`));

if (!fs.existsSync(`${restorePath}`)) {
    console.log(`Directory ${restorePath} does not exist. Creating...`);
    mkdirp.sync(`${restorePath}`);
}

console.log(`Creating ${restorePath}/${configDirectory} directory...`);
mkdirp.sync(`${restorePath}/${configDirectory}`, (err) => { if (err) throw err; });

for (const file of files) {
    let src = `${configPath}/${configDirectory}/${file}`;
    let dest = `${restorePath}/${configDirectory}/${file}`;
    if (file === configName) {
        src = `${configPath}/${file}`;
        dest = `${restorePath}/${file}`;
    }

    console.log(`Restore: ${src} -> ${dest}`);
    fs.copyFile(src, dest, (err) => { if (err) throw err; });
}

console.log('Database import...');

switch (configFile.database.provider) {
case 'arangodb':
    exec(
        `arangorestore --server.database ${configFile.database.database} --server.username ${configFile.database.username} --server.password ${configFile.database.password === '' ? '\'\'' : configFile.database.password} --input-directory '${configPath}/${databaseDirectory}/arangodb/' --overwrite true`,
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
