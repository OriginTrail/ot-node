const fs = require('fs-extra');
const path = require('path');
const appRootPath = require('app-root-path');
require('dotenv').config({path: `${appRootPath.path}/.env`});
const { execSync } = require('child_process');
const rc = require('rc');
const semver = require('semver');
const OTNode = require('./ot-node');
const pjson = require('./package.json');

const configjson = require('./config/config.json');

process.env.NODE_ENV =
    process.env.NODE_ENV && ['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) >= 0
        ? process.env.NODE_ENV
        : 'development';

let config = JSON.parse(fs.readFileSync(path.join(appRootPath.path, '.origintrail_noderc'), 'utf8'));
const defaultConfig = JSON.parse(JSON.stringify(configjson[process.env.NODE_ENV]));

config = rc(pjson.name, defaultConfig);

(async () => {
    let userConfig = null;
    try {
        if (process.env.NODE_ENV === 'development' && process.argv.length === 3) {
            const configurationFilename = process.argv[2];
            userConfig = JSON.parse(fs.readFileSync(process.argv[2]));
            userConfig.configFilename = configurationFilename;
        }
    } catch (error) {
        console.log('Unable to read user configuration from file: ', process.argv[2]);
        process.exit(1);
    }
    try {
        const node = new OTNode(userConfig);
        await node.start();
    } catch (e) {
        console.error(`Error occurred while start ot-node, error message: ${e}. ${e.stack}`);
        console.error(`Trying to recover from older version`);

        const rootPath = path.join(appRootPath.path, '..');
        const oldVersionsDirs = (await fs.promises.readdir(rootPath, { withFileTypes: true }))
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name)
            .filter((name) => semver.valid(name) && !appRootPath.path.includes(name));

        if (oldVersionsDirs.length === 0) {
            console.error(
                `Failed to start OT-Node, no backup code available. Error message: ${e.message}`,
            );
            process.exit(1);
        }

        const oldVersion = oldVersionsDirs.sort(semver.compare).pop();
        const oldversionPath = path.join(rootPath, oldVersion);
        execSync(`ln -sfn ${oldversionPath} ${rootPath}/ot-node`);
        await fs.promises.rm(appRootPath.path, { force: true, recursive: true });
        process.exit(1);
    }
})();

process.on('uncaughtException', (err) => {
    console.error('Something went really wrong! OT-node shutting down...', err);
    process.exit(1);
});
