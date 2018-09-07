/* eslint-disable no-unused-expressions */
const Command = require('../.././../../modules/command/dc/dc-offer-create-database-command');
const models = require('../../../../models/index');
const BN = require('bn.js');
const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
const Utilities = require('../.././../../modules/Utilities');
const GraphStorage = require('../.././../../modules/Database/GraphStorage');
const Storage = require('../.././../../modules/Storage');
const { Database } = require('arangojs');

const ImportUtilities = require('../.././../../modules/ImportUtilities');
const sequelizeConfig = require('../../../../config/config.json').development;
const CommandResolver = require('../.././../../modules/command/command-resolver');
const CommandExecutor = require('../.././../../modules/command/command-executor');
const awilix = require('awilix');
// const Models = require('../../../../models');

function buildSelectedDatabaseParam(databaseName) {
    return {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: databaseName,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database_system: 'arango_db',
    };
}

describe.only('Check for dc offer create database command', function () {
    this.timeout(5000);
    let graphStorage;
    let systemDb;
    const databaseName = 'dc_offer_create_db';
    before('Setup models', async () => {
        Storage.models = (await models.sequelize.sync()).models;
    });

    beforeEach('precondition', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth(process.env.DB_USERNAME, process.env.DB_PASSWORD);

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
            databaseName,
            [{ username: process.env.DB_USERNAME, passwd: process.env.DB_PASSWORD, active: true }],
        );

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });
        const logger = Utilities.getLogger();
        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName), logger);
    });

    it('should console log', () => {
        console.log('Hello');
    });

    afterEach('Drop DB', async () => {
        if (systemDb) {
            const listOfDatabases = await systemDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await systemDb.dropDatabase(databaseName);
            }
        }
    });
});
