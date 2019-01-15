const fs = require('fs');
const Umzug = require('umzug');
const sequelizeConfig = require('./../../config/sequelizeConfig').development;

const models = require('../../models/index');

const logger = require('../../modules/logger');

/**
 * Recreate SQL database from scratch
 * @return {Promise<any>}
 */
function recreateDatabase() {
    fs.closeSync(fs.openSync(sequelizeConfig.storage, 'w'));

    const migrator = new Umzug({
        storage: 'sequelize',
        storageOptions: {
            sequelize: models.sequelize,
            tableName: 'migrations',
        },
        logging: logger.debug,
        migrations: {
            params: [models.sequelize.getQueryInterface(), models.Sequelize],
            path: `${__dirname}/../../migrations`,
            pattern: /^\d+[\w-]+\.js$/,
        },
    });

    const seeder = new Umzug({
        storage: 'sequelize',
        storageOptions: {
            sequelize: models.sequelize,
            tableName: 'seeders',
        },
        logging: logger.debug,
        migrations: {
            params: [models.sequelize.getQueryInterface(), models.Sequelize],
            path: `${__dirname}/../../seeders`,
            pattern: /^\d+[\w-]+\.js$/,
        },
    });

    return models.sequelize.authenticate().then(() => migrator.up().then(() => seeder.up()));
}

module.exports = {
    recreateDatabase,
};
