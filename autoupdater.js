const { execSync } = require('child_process');
const request = require('request');
const fs = require('fs');
const Zip = require('machinepack-zip');
const logger = require('./modules/logger');

process.once('message', async ([options]) => {
    const filename = `https://github.com/${options.autoUpdater.repo}/archive/${options.autoUpdater.branch}.zip`;
    logger.info(`Downloading update: ${filename} ...`);
    const response = await request(filename);
    const filestream = fs.createWriteStream('update.zip');
    response.pipe(filestream);

    filestream.on('finish', () => {
        logger.info('Download complete');
        logger.info('Extracting update...');

        Zip.unzip({
            source: 'update.zip',
            destination: '..',
        }).exec({
            error(err) {
                logger.error(err);
            },

            success() {
                try {
                    logger.info('Update extraction complete');
                    logger.info(`Moving update to directory ${options.version}...`);

                    logger.info('Cleaning update destination directory');
                    execSync(`rm -rf ../${options.version}`);

                    let extractedFileName = options.autoUpdater.branch;
                    logger.info(extractedFileName);
                    extractedFileName = `ot-node-${extractedFileName.replace('/', '-')}`;
                    execSync(`mv ../${extractedFileName} ../${options.version}`);

                    logger.info(`Update has been moved to directory ${options.version}`);
                    logger.info('Migrating node modules...');

                    execSync(`cp -r ./node_modules ../${options.version}/`);
                    logger.info('Node modules migrated');
                    logger.info('Installing new node modules');

                    execSync(`cd ../${options.version} && npm install`);
                    logger.info('npm modules have been installed');
                    process.send('complete');
                } catch (err) {
                    logger.warn('Update failed');
                    logger.error(err);
                } finally {
                    process.exit(0);
                }
            },
        });
    });
});
