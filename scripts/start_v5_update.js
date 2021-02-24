require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const rc = require('rc');
const pjson = require('../package.json');
const configjson = require('../config/config.json');

const defaultConfig = configjson[process.env.NODE_ENV];
const config = rc(pjson.name, defaultConfig);

const updateFilepath = '/ot-node/current/UPDATE';
const destinationBasedir = '/ot-node/';

const updater = fork(path.join(__dirname, '..', 'testnet', 'prepare-update.js'), [], {
    stdio: [0, 1, 2, 'ipc'],
});

updater.on('message', async (result) => {
    if (result.status !== 'completed') {
        // Something went wrong.
        console.log(`Failed to prepare update. Status: ${result.status}.`);
        return;
    }

    console.log(`Update ready for version ${result.version}.`);
    console.log(updateFilepath);
    fs.writeFileSync(updateFilepath, JSON.stringify({
        version: result.version,
        path: result.installDir,
        configPath: config.appDataPath,
    }));
}).on('error', (error) => {
    console.log(`Failed to check prepare update. ${error}`);
});


const options = {
    archiveUrl: config.autoUpdater.archiveUrl,
    destinationBaseDir: destinationBasedir,
};

updater.send(options);
