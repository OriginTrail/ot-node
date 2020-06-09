const mkdirp = require('mkdirp');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

let environment;
if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    environment = 'testnet';
} else if (['development', 'testnet', 'mainnet', 'mariner'].indexOf(process.env.NODE_ENV) < 0) {
    console.error(`Unsupported environment '${process.env.NODE_ENV}'`);
    return 1;
} else if (process.env.NODE_ENV === 'mariner') {
    environment = 'mainnet';
} else {
    environment = process.env.NODE_ENV;
}

const configjson = require('../config/config.json');

const defaultConfig = configjson[environment];

let timestamp = new Date().toISOString();

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

const files = ['identity.json', 'kademlia.crt', 'kademlia.key', 'arango.txt', 'houston.txt', 'system.db', 'erc725_identity.json', configName];
const certs = ['fullchain.pem', 'privkey.pem'];

let configFile;
if (configPath !== '') {
    configFile = JSON.parse(fs.readFileSync(`${configPath}/${configName}`));
} else {
    configFile = JSON.parse(fs.readFileSync(`${configName}`));
}

while (fs.existsSync(`${backupPath}/${timestamp}`)) {
    console.log(`Directory ${backupPath}/${timestamp} already exists. Generating new timestamp...`);
    timestamp = new Date().toISOString();
}


try {
    console.log(`Creating ${backupPath}/${timestamp} directories...`);
    mkdirp.sync(`${backupPath}/${timestamp}`);

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
        } else if (file === 'arango.txt') {
            console.log(`Could not find backup file ${src}.`);
        } else {
            throw Error(`Could not find necessary backup file ${src}, aborting!`);
        }
    }

    const migrationFolderPath = `${configDirectory}/migrations`;
    if (fs.existsSync(migrationFolderPath)) {
        const migrationFiles = fs.readdirSync(migrationFolderPath);

        mkdirp.sync(`${backupPath}/${timestamp}/migrations`, (err) => { if (err) { console.error(err); return 1; } });

        for (const migrationFile of migrationFiles) {
            const src = `${migrationFolderPath}/${migrationFile}`;
            const dest = `${backupPath}/${timestamp}/migrations/${migrationFile}`;

            console.log(`Backup: ${src} -> ${dest}`);
            fs.copyFileSync(src, dest, (err) => { if (err) { console.error(err); return 1; } });
        }
    } else {
        throw Error(`Could not find necessary directory ${configDirectory}/migrations, aborting!`);
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

    let databaseName;
    switch (configFile.database.provider) {
    case 'arangodb':
        databaseName = 'arangodb';
        exec(
            `arangodump --server.database ${configFile.database.database} --server.username ${configFile.database.username} --server.password ${configFile.database.password === '' ? '\'\'' : configFile.database.password} --output-directory '${backupPath}/${timestamp}/arangodb' --overwrite true`,
            (error, stdout, stderr) => {
                console.log(`${stdout}`);
                if (error !== null) {
                    console.log('***********************************************');
                    console.log('*****                                     *****');
                    console.log('***        Backup process FAILED!           ***');
                    console.log('*****                                     *****');
                    console.log('***********************************************');

                    console.log('Database backup process failed, aborting!');
                    console.error(`${error}`);

                    console.log('Please contact support for alternative instructions on backing up your node');

                    if (fs.existsSync(`${backupPath}/${timestamp}`)) {
                        exec(`rm -rf ${backupPath}/${timestamp}`);
                    }

                    return 1;
                }
                console.log('***********************************************');
                console.log('*****                                     *****');
                console.log('***        Backup process complete!         ***');
                console.log('*****                                     *****');
                console.log('***********************************************');
            },
        );
        break;
    default:
        break;
    }

    return 0;
} catch (error) {
    console.log('***********************************************');
    console.log('*****                                     *****');
    console.log('***        Backup process FAILED!           ***');
    console.log('*****                                     *****');
    console.log('***********************************************');

    console.log(error.message);
    console.log('Please contact support for alternative instructions on backing up your node');

    if (fs.existsSync(`${backupPath}/${timestamp}`)) {
        exec(`rm -rf ${backupPath}/${timestamp}`);
    }

    return 1;
}

