const { execSync } = require('child_process');
const request = require('request');
const fs = require('fs');
const Zip = require('machinepack-zip');
const Umzug = require('umzug');
const logger = require('../modules/logger');

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
                    logger.info('Migrating node configuration');

                    execSync(`cp -r ${options.appDataPath} /ot-node/${options.version}/`);
                    logger.info('Configuration migration complete');

                    const SEQUELIZEDB_OLD = process.env.SEQUELIZEDB;
                    process.env.SEQUELIZEDB = `/ot-node/${options.version}/data/system.db`;

                    // eslint-disable-next-line
                    const Models = require(`../${options.version}/models`);

                    const umzug_migrations = new Umzug({

                        storage: 'sequelize',

                        storageOptions: {
                            sequelize: Models.sequelize,
                        },

                        migrations: {
                            params: [Models.sequelize.getQueryInterface(),
                                Models.sequelize.constructor, () => {
                                    throw new Error('Migration tried to use old style "done" callback. Please upgrade to "umzug" and return a promise instead.');
                                }],
                            path: `../${options.version}/migrations`,
                            pattern: /\.js$/,
                        },
                    });

                    umzug_migrations.up().then((migrations) => {
                        logger.info('Database migrated.');
                        logger.info('Switching node version');
                        process.send('complete');
                        execSync(`ln -sfn /ot-node/${options.version}/ /ot-node/current`);
                        process.exit(0);
                    }).catch((err) => {
                        logger.error('Update failed');
                        process.env.SEQUELIZEDB = SEQUELIZEDB_OLD;
                        logger.error(err);
                    });
                } catch (err) {
                    // TODO: Rollback
                    logger.error(err);
                }
            },
        });
    });
});
