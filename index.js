const fs = require('fs-extra');
const path = require('path');
const appRootPath = require('app-root-path');
const { exec, execSync } = require('child_process');
const OTNode = require('./ot-node');

(async () => {
    try {
        const node = new OTNode();
        await node.start();
    } catch (e) {
        console.error(`Error occurred while starting new version, error message: ${e}`);
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
