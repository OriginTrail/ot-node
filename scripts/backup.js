const fs = require('fs');
const Models = require('../models');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');

const backupPath = '../Backup';
const configPath = '../config/config.json';

async function checkConfigInfo() {
    const configInfo = await Models.node_data.find({ where: { key: 'node-config' } });
    return configInfo;
}

async function updateConfigInfo(timestamp) {
    await Models.node_data.update(
        {
            value: timestamp,
        },
        {
            where: {
                key: 'node-config',
            },
        },
    );
}

function createNewBackup(timestamp) {
    fs.mkdir(`${backupPath}/${timestamp}`, (err) => {
        if (err) throw err;
    });

    fs.copyFile(configPath, `${backupPath}/${timestamp}/config.json`, (err) => {
        if (err) throw err;
    });
}

async function handleModification(configInfo) {
    const stat = fs.statSync(configPath);

    const modificationTime = new Date(stat.mtime).getTime();
    const previousModificationTime = configInfo.value;

    if (modificationTime > previousModificationTime) {
        await updateConfigInfo(stat.mtime.getTime().toString());
        createNewBackup(stat.mtime.toString());
        console.log('Modification have occurred');
    } else {
        console.log('Ther was no modification');
    }
}

async function main() {
    if (argv.configDir) {
        Models.sequelize.options.storage = path.join(argv.configDir, 'system.db');
    }
    const configInfo = await checkConfigInfo();
    await handleModification(configInfo);
}

main();
