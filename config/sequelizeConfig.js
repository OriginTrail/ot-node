require('dotenv').config();
const path = require('path');
const homedir = require('os').homedir();
const pjson = require('../package.json');

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'testnet';
}

const storagePath = process.env.SEQUELIZEDB ?
    process.env.SEQUELIZEDB :
    path.join(homedir, `.${pjson.name}rc`, process.env.NODE_ENV, 'system.db');

module.exports = {
    [process.env.NODE_ENV]: {
        database: 'ot_node_db',
        host: 'localhost',
        port: 5432,
        dialect: 'postgres',
        username: 'ot-node',
        password: 'origintrail',
        native: true,
        ssl: true,
        migrationStorageTableName: 'sequelize_meta',
        logging: false,
        operatorsAliases: false,
        define: {
            underscored: true,
            timestamps: false,
        },
    },
};
