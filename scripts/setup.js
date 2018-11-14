/* eslint-disable no-console */
require('dotenv').config();

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'production';
} else if (['development', 'staging', 'stable', 'mariner', 'production'].indexOf(process.env.NODE_ENV) < 0) {
    throw Error(`Unsupported environment '${process.env.NODE_ENV}'`);
}

const { Database } = require('arangojs');
const homedir = require('os').homedir();
const path = require('path');
const mkdirp = require('mkdirp');
const fs = require('fs');
const { execSync } = require('child_process');
const argv = require('minimist')(process.argv.slice(2));
const rc = require('rc');

// Check for arguments sanity.
if (argv.all && argv.configDir) {
    throw Error('Cannot use --all and --configDir argument at the same time.');
}

const pjson = require('../package.json');
const configjson = require('../config/config.json');

console.info('Setting up OT node...');
console.info(`Environment: ${process.env.NODE_ENV}`);

const configDirs = [];
const arangoDbs = [];
const sqliteDbName = 'system.db';
const peerCacheName = 'peercache';
const configFileName = 'config.json';

// Load config.
const defaultConfig = configjson[process.env.NODE_ENV];
const config = rc(pjson.name, defaultConfig);

if (argv.configDir) {
    configDirs.push(argv.configDir);
    arangoDbs.push(defaultConfig.database);
} else if (argv.all) { // All environments?
    configDirs.push(path.join(
        homedir,
        `.${pjson.name}rc`,
        'development',
    ));
    configDirs.push(path.join(
        homedir,
        `.${pjson.name}rc`,
        'staging',
    ));
    configDirs.push(path.join(
        homedir,
        `.${pjson.name}rc`,
        'stable',
    ));
    configDirs.push(path.join(
        homedir,
        `.${pjson.name}rc`,
        'production',
    ));

    // Add arango DBs.
    arangoDbs.push(configjson.development.database);
    arangoDbs.push(configjson.staging.database);
    arangoDbs.push(configjson.stable.database);
    arangoDbs.push(configjson.production.database);
} else {
    configDirs.push(path.join(
        homedir,
        `.${pjson.name}rc`,
        process.env.NODE_ENV,
    ));
    arangoDbs.push(config.database);
}

// If --hard delete everything.
if (argv.hard) {
    configDirs.forEach((configPath) => {
        console.info(`Removing '${configPath}...'`);
        execSync(`rm -rf "${configPath}" &> /dev/null`);
    });
} else {
    // Just drop SQLite db, configs and cache.
    configDirs.forEach((configPath) => {
        const dbPath = path.join(configPath, sqliteDbName);
        const peerCachePath = path.join(configPath, peerCacheName);
        const configFilePath = path.join(configPath, configFileName);
        if (fs.existsSync(dbPath)) {
            console.info(`Removing '${dbPath}...'`);
            fs.unlinkSync(dbPath);
        }
        if (fs.existsSync(peerCachePath)) {
            console.info(`Removing '${peerCachePath}...'`);
            fs.unlinkSync(peerCachePath);
        }
        if (fs.existsSync(configFilePath)) {
            console.info(`Removing '${configFilePath}...'`);
            fs.unlinkSync(configFilePath);
        }
    });
}

// SQLite db.
configDirs.forEach((configPath) => {
    // Make sure dir exist before creating db.
    mkdirp.sync(configPath);

    // Create db path if not exist.
    const dbPath = path.join(configPath, sqliteDbName);
    fs.appendFileSync(dbPath, '');
    console.info(`Running migrations for '${dbPath}'...`);
    process.env.SEQUELIZEDB = dbPath; // Tell Sequelize to which db to generate.
    execSync('sequelize --config=./config/sequelizeConfig.js db:migrate');
    console.info(`Running seeders for '${dbPath}'...`);
    execSync('./node_modules/.bin/sequelize --config=./config/sequelizeConfig.js db:seed:all');
});

// Graph DB.
async function resetArangoDb(database) {
    console.info(`Setting up graph database '${database.database}'...`);
    const systemDb = new Database();
    systemDb.useBasicAuth(database.username, database.password);

    // Drop test database if exist.
    const listOfDatabases = await systemDb.listDatabases();
    if (listOfDatabases.includes(database.database)) {
        await
        systemDb.dropDatabase(database.database);
    }

    await
    systemDb.createDatabase(
        database.database,
        [{ username: database.username, passwd: database.password, active: true }],
    );
}

arangoDbs.forEach((database) => {
    resetArangoDb(database).catch((error) => {
        console.error(`Failed to create '${JSON.stringify(database)}'in Arango DB. ${error}.`);
        process.abort();
    });
});

