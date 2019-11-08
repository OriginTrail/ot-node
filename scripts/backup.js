const fs = require('fs');
const Models = require('../models');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const BackupService = require('../modules/service/backup-service');

// const backupPath = '../Backup';

const backupService = new BackupService();
const keynameMap = backupService.getMap();
const backupPath = backupService.getBackupPath();

// const configPath = '../config/config.json';
//
// const keynameMap = new Map();
// keynameMap.set('kademlia-identity', ['../../config/DCG/identity-test.json', '../../config/DCG/kademlia-test.crt', '../../config/DCG/kademlia-test.key']);
// keynameMap.set('node-config', ['../config/config-test.json']);

function extractNameFromPath(path) {
    const n = path.lastIndexOf('/');
    return path.slice(n + 1);
}

async function checkFileInfo(filename) {
    const configInfo = await Models.node_data.find({ where: { key: filename } });
    return configInfo;
}

async function updateFileInfo(timestamp, filename) {
    await Models.node_data.update(
        {
            value: timestamp,
        },
        {
            where: {
                key: filename,
            },
        },
    );
}

function createNewBackup(timestamp, keyname) {
    fs.mkdirSync(`${backupPath}/${keyname}/${timestamp}`, (err) => {
        if (err) throw err;
    });
    for (const path of keynameMap.get(keyname)) {
        const filename = extractNameFromPath(path);
        fs.copyFile(path, `${backupPath}/${keyname}/${timestamp}/${filename}`, (err) => {
            if (err) throw err;
        });
    }
}

async function checkForModification(keyname) {
    let max_timestamp = -1;
    for (const path of keynameMap.get(keyname)) {
        const filename = extractNameFromPath(path);
        const stat = fs.statSync(path);
        // eslint-disable-next-line no-await-in-loop
        const configInfo = await checkFileInfo(filename);
        // console.log(filename);

        const modificationTime = new Date(stat.mtime).getTime();
        const previousModificationTime = configInfo.value;

        if (modificationTime > previousModificationTime) {
            if (modificationTime > max_timestamp) {
                max_timestamp = modificationTime;
            }
        }
    }
    return max_timestamp;
}

async function handleModification(keyname) {
    const timestamp = await checkForModification(keyname);
    console.log(timestamp);
    if (timestamp > -1) {
        for (const path of keynameMap.get(keyname)) {
            const filename = extractNameFromPath(path);
            // eslint-disable-next-line no-await-in-loop
            await updateFileInfo(timestamp, filename);
        }
        createNewBackup(timestamp, keyname);
        console.log(`Modification have occurred in ${keyname}`);
    } else {
        console.log(`There was no modification in ${keyname}`);
    }
}

async function main() {
    console.log('STARTING BACKUP');
    if (argv.configDir) {
        Models.sequelize.options.storage = path.join(argv.configDir, 'system.db');
    }
    const promises = [];
    keynameMap.forEach((value, key) => {
        promises.push(handleModification(key));
    });
    await Promise.all(promises);
}

main();

// eslint-disable-next-line import/prefer-default-export
module.exports = main;
