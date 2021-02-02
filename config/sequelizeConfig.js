require('dotenv').config();
const path = require('path');
const homedir = require('os').homedir();
const pjson = require('../package.json');
const constants = require('../modules/constants');
const configjson = require('./config.json');
const rc = require('rc');

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'testnet';
}

if (process.env.DB_TYPE === constants.DB_TYPE.psql) {
    const defaultConfig = configjson[
        process.env.NODE_ENV &&
        ['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) >= 0 ?
            process.env.NODE_ENV : 'development'];
    const config = rc(pjson.name, defaultConfig);

    module.exports = {
        [process.env.NODE_ENV]: {
            database: config.operational_db.database,
            host: config.operational_db.host,
            port: config.operational_db.port,
            dialect: 'postgres',
            username: config.operational_db.username,
            password: config.operational_db.password,
            native: true,
            ssl: true,
            migrationStorageTableName: 'sequelize_meta',
            logging: false,
            operatorsAliases: false,
            define: {
                underscored: true,
                timestamps: false,
            },
            retry: {
                match: [
                    /SQLITE_BUSY/,
                ],
                name: 'query',
                max: 5,
            },
        },
    };
} else {
    const storagePath = process.env.SEQUELIZEDB ?
        process.env.SEQUELIZEDB :
        path.join(homedir, `.${pjson.name}rc`, process.env.NODE_ENV, 'system.db');

    module.exports = {
        [process.env.NODE_ENV]: {
            database: 'main',
            host: '127.0.0.1',
            dialect: 'sqlite',
            storage: storagePath,
            migrationStorageTableName: 'sequelize_meta',
            logging: false,
            operatorsAliases: false,
            define: {
                underscored: true,
                timestamps: false,
            },
            retry: {
                match: [
                    /SQLITE_BUSY/,
                ],
                name: 'query',
                max: 5,
            },
        },
    };
}

