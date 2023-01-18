/* eslint-disable */
import 'dotenv/config';
import mysql from 'mysql2';
import path from 'path';
import fs from 'fs-extra';
import { stat } from 'fs/promises';
import TripleStoreModuleManager from '../../src/modules/triple-store/triple-store-module-manager.js';
import Logger from '../../src/logger/logger.js';

const generalConfig = JSON.parse(fs.readFileSync('./config/config.json'));

const logger = new Logger(generalConfig.development.logLevel);

const numberOfNodes = parseInt(process.argv[2], 10);
const network = process.argv[3];
const tripleStoreImplementation = process.argv[4];
const hubContractAddress = process.argv[5];

const dhTemplatePath = './tools/local-network-setup/.dh_origintrail_noderc_template';
const bootstrapTemplatePath = './tools/local-network-setup/.bootstrap_origintrail_noderc_template';
const keys = JSON.parse(fs.readFileSync('./tools/local-network-setup/keys.json'));

logger.info('Preparing keys for blockchain');

if (!keys) {
    logger.warn('Missing blockchain keys');
    process.exit(1);
}

logger.info(`Generating config for ${numberOfNodes} node(s)`);

for (let i = 0; i < numberOfNodes; i += 1) {
    const blockchainConfig = {
        hubContractAddress,
        rpcEndpoints: [process.env.RPC_ENDPOINT],
        evmOperationalWalletPublicKey: keys.publicKey[i],
        evmOperationalWalletPrivateKey: keys.privateKey[i],
        evmManagementWalletPublicKey: keys.publicKey[keys.publicKey.length - 1 - i],
        evmManagementWalletPrivateKey: keys.privateKey[keys.privateKey.length - 1 - i],
        sharesTokenName: `LocalNode${i}`,
        sharesTokenSymbol: `LN${i}`,
    };
    let appDataPath = `data${i}`;
    let nodeName;
    let templatePath;
    let configPath;
    if (i === 0) {
        templatePath = bootstrapTemplatePath;
        configPath = path.join('./tools/local-network-setup/.bootstrap_origintrail_noderc');
        nodeName = 'bootstrap';
    } else {
        templatePath = dhTemplatePath;
        configPath = path.join(`./tools/local-network-setup/.dh${i}_origintrail_noderc`);
        nodeName = `DH${i}`;
    }

    if (await fileExists(configPath)) continue;

    const template = JSON.parse(fs.readFileSync(templatePath));

    const tripleStoreConfig =
        template.modules.tripleStore.implementation[tripleStoreImplementation].config;
    for (const [repository, config] of Object.entries(tripleStoreConfig.repositories)) {
        tripleStoreConfig.repositories[repository].name = `${config.name}-${i}`;
    }
    template.modules.tripleStore.implementation[tripleStoreImplementation] = {
        ...template.modules.tripleStore.implementation[tripleStoreImplementation],
        enabled: true,
        config: tripleStoreConfig,
    };

    template.modules.blockchain.defaultImplementation = network;
    template.modules.blockchain.implementation[network].config = {
        ...template.modules.blockchain.implementation[network].config,
        ...blockchainConfig,
    };

    template.modules.httpClient.implementation['express-http-client'].config.port = 8900 + i;
    template.modules.network.implementation['libp2p-service'].config.port = 9100 + i;
    template.modules.repository.implementation[
        'sequelize-repository'
    ].config.database = `operationaldb${i}`;
    template.appDataPath = appDataPath;

    if (process.env.LOG_LEVEL) {
        template.logLevel = process.env.LOG_LEVEL;
    }
    logger.info(`Configuring node ${nodeName}`);

    fs.writeFileSync(configPath, JSON.stringify(template, null, 4));
}

for (let i = 0; i < numberOfNodes; i += 1) {
    let configPath;
    if (i === 0) {
        configPath = path.join('./tools/local-network-setup/.bootstrap_origintrail_noderc');
    } else {
        configPath = path.join(`./tools/local-network-setup/.dh${i}_origintrail_noderc`);
    }
    const config = JSON.parse(fs.readFileSync(configPath));
    await dropDatabase(
        `operationaldb${i}`,
        generalConfig.development.modules.repository.implementation['sequelize-repository'].config,
    );
    await deleteTripleStoreRepositories(config);
}

async function dropDatabase(name, config) {
    logger.info(`Dropping database: ${name}`);
    const password = process.env.REPOSITORY_PASSWORD ?? config.password;
    const connection = mysql.createConnection({
        database: name,
        user: config.user,
        host: config.host,
        password,
    });
    try {
        await connection.promise().query(`DROP DATABASE IF EXISTS ${name};`);
    } catch (e) {
        logger.warn(`Error while dropping database. Error: ${e.message}`);
    }
    connection.destroy();
}

async function deleteTripleStoreRepositories(config) {
    const tripleStoreModuleManager = new TripleStoreModuleManager({ config, logger });
    await tripleStoreModuleManager.initialize();

    for (const implementationName of tripleStoreModuleManager.getImplementationNames()) {
        const { module, config } = tripleStoreModuleManager.getImplementation(implementationName);
        await Promise.all(
            Object.keys(config.repositories).map((repository) =>
                module.deleteRepository(repository),
            ),
        );
    }
}

async function fileExists(filePath) {
    try {
        await stat(filePath);
        return true;
    } catch (e) {
        return false;
    }
}
