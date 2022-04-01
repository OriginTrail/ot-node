const fs = require('fs-extra');
const path = require('path');
const appRootPath = require('app-root-path');
const { exec, execSync } = require('child_process');
const rc = require('rc');
const OTNode = require('./ot-node');
const pjson = require('./package.json');

const configjson = require('./config/config.json');

process.env.NODE_ENV = process.env.NODE_ENV && ['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) >= 0
    ? process.env.NODE_ENV : 'development';

let config = JSON.parse(fs.readFileSync('./.origintrail_noderc', 'utf8'));
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
        console.error(`Error occurred while starting new version, error message: ${e}. ${e.stack}`);
        if (!config.autoUpdate.enabled) {
            console.log('Auto update is disabled. Shutting down the node...');
            process.exit(1);
        }

        const backupCode = `${config.autoUpdate.backupDirectory}/AutoGitUpdate/backup`;
        if (fs.ensureDir(backupCode)) {
            console.log('Starting back old version of OT-Node.');

            const source = path.join(config.autoUpdate.backupDirectory, 'AutoGitUpdate', 'backup');
            const destination = appRootPath.path;
            await fs.ensureDir(destination);
            await fs.copy(source, destination);

            await new Promise((resolve, reject) => {
                const command = `cd ${destination} && npm install`;
                const child = exec(command);

                // Wait for results
                child.stdout.on('end', resolve);
                child.stdout.on('data', (data) => console.log(`Auto Git Update - npm install: ${data.replace(/\r?\n|\r/g, '')}`));
                child.stderr.on('data', (data) => {
                    if (data.toLowerCase().includes('error')) {
                        // npm passes warnings as errors, only reject if "error" is included
                        data = data.replace(/\r?\n|\r/g, '');
                        console.error('Auto Git Update - Error installing dependencies');
                        console.error(`Auto Git Update - ${data}`);
                        reject();
                    } else {
                        console.log(`Auto Git Update - ${data}`);
                    }
                });
            });
            execSync(`cd ${destination} && npx sequelize --config=./config/sequelizeConfig.js db:migrate`, { stdio: 'inherit' });
            process.exit(1);
        } else {
            console.error(`Failed to start OT-Node, no backup code available. Error message: ${e.message}`);
            process.exit(1);
        }
    }
})();

process.on('uncaughtException', (err) => {
    console.error('Something went really wrong! OT-node shutting down...', err);
    process.exit(1);
});
