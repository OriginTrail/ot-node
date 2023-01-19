/* eslint-disable */
import 'dotenv/config';
import mysql from 'mysql2';
import path from 'path';
import fs from 'fs-extra';
import TripleStoreModuleManager from '../../src/modules/triple-store/triple-store-module-manager.js';
import Logger from '../../src/logger/logger.js';

const { readFile, writeFile, stat } = fs;

const generalConfig = JSON.parse(await readFile('./config/config.json'));
const templatePath = path.join('./tools/local-network-setup/.origintrail_noderc_template.json');
const keys = JSON.parse(await readFile('./tools/local-network-setup/keys.json'));

const logger = new Logger(generalConfig.development.logLevel);

const numberOfNodes = parseInt(process.argv[2], 10);
const blockchain = process.argv[3];
const tripleStoreImplementation = process.argv[4];
const hubContractAddress = process.argv[5];
const libp2pBootstrapPrivateKey =
    'CAAS4QQwggJdAgEAAoGBALOYSCZsmINMpFdH8ydA9CL46fB08F3ELfb9qiIq+z4RhsFwi7lByysRnYT/NLm8jZ4RvlsSqOn2ZORJwBywYD5MCvU1TbEWGKxl5LriW85ZGepUwiTZJgZdDmoLIawkpSdmUOc1Fbnflhmj/XzAxlnl30yaa/YvKgnWtZI1/IwfAgMBAAECgYEAiZq2PWqbeI6ypIVmUr87z8f0Rt7yhIWZylMVllRkaGw5WeGHzQwSRQ+cJ5j6pw1HXMOvnEwxzAGT0C6J2fFx60C6R90TPos9W0zSU+XXLHA7AtazjlSnp6vHD+RxcoUhm1RUPeKU6OuUNcQVJu1ZOx6cAcP/I8cqL38JUOOS7XECQQDex9WUKtDnpHEHU/fl7SvCt0y2FbGgGdhq6k8nrWtBladP5SoRUFuQhCY8a20fszyiAIfxQrtpQw1iFPBpzoq1AkEAzl/s3XPGi5vFSNGLsLqbVKbvoW9RUaGN8o4rU9oZmPFL31Jo9FLA744YRer6dYE7jJMel7h9VVWsqa9oLGS8AwJALYwfv45Nbb6yGTRyr4Cg/MtrFKM00K3YEGvdSRhsoFkPfwc0ZZvPTKmoA5xXEC8eC2UeZhYlqOy7lL0BNjCzLQJBAMpvcgtwa8u6SvU5B0ueYIvTDLBQX3YxgOny5zFjeUR7PS+cyPMQ0cyql8jNzEzDLcSg85tkDx1L4wi31Pnm/j0CQFH/6MYn3r9benPm2bYSe9aoJp7y6ht2DmXmoveNbjlEbb8f7jAvYoTklJxmJCcrdbNx/iCj2BuAinPPgEmUzfQ=';

logger.info(`Generating config for ${numberOfNodes} node(s)`);

/********************************
    CONFIG GENERATION
*********************************/

const promises = [];
for (let i = 0; i < numberOfNodes; i += 1) {
    promises.push(generateNodeConfig(i));
}
await Promise.all(promises);

/********************************
    FUNCTIONS DEFINITIONS
*********************************/

async function generateNodeConfig(nodeIndex) {
    const configPath = path.join(
        `./tools/local-network-setup/.node${nodeIndex}_origintrail_noderc.json`,
    );

    if (!(await fileExists(configPath))) {
        const template = JSON.parse(await readFile(templatePath));

        logger.info(`Configuring node ${nodeIndex}`);
        template.modules.tripleStore = generateTripleStoreConfig(
            template.modules.tripleStore,
            nodeIndex,
        );
        template.modules.blockchain = generateBlockchainConfig(
            template.modules.blockchain,
            nodeIndex,
        );
        template.modules.httpClient = generateHttpClientConfig(
            template.modules.httpClient,
            nodeIndex,
        );
        template.modules.network = generateNetworkConfig(template.modules.network, nodeIndex);
        template.modules.repository = generateRepositoryConfig(
            template.modules.repository,
            nodeIndex,
        );
        template.appDataPath = `data${nodeIndex}`;
        template.logLevel = process.env.LOG_LEVEL ?? template.logLevel;

        await writeFile(configPath, JSON.stringify(template, null, 4));
    }
    const config = JSON.parse(await readFile(configPath));
    await dropDatabase(
        `operationaldb${nodeIndex}`,
        generalConfig.development.modules.repository.implementation['sequelize-repository'].config,
    );
    await deleteTripleStoreRepositories(config);
}

function generateTripleStoreConfig(templateTripleStoreConfig, nodeIndex) {
    const tripleStoreConfig = JSON.parse(JSON.stringify(templateTripleStoreConfig));

    for (const implementationName in tripleStoreConfig.implementation) {
        for (const [repository, config] of Object.entries(
            tripleStoreConfig.implementation[implementationName].config.repositories,
        )) {
            tripleStoreConfig.implementation[implementationName].config.repositories[
                repository
            ].name = `${config.name}-${nodeIndex}`;
        }
        tripleStoreConfig.implementation[implementationName].enabled =
            implementationName === tripleStoreImplementation ? true : false;
    }

    return tripleStoreConfig;
}

function generateBlockchainConfig(templateBlockchainConfig, nodeIndex) {
    const blockchainConfig = JSON.parse(JSON.stringify(templateBlockchainConfig));

    blockchainConfig.implementation[blockchain].config = {
        ...blockchainConfig.implementation[blockchain].config,
        hubContractAddress,
        rpcEndpoints: [process.env.RPC_ENDPOINT],
        evmOperationalWalletPublicKey: keys.publicKey[nodeIndex],
        evmOperationalWalletPrivateKey: keys.privateKey[nodeIndex],
        evmManagementWalletPublicKey: keys.publicKey[keys.publicKey.length - 1 - nodeIndex],
        evmManagementWalletPrivateKey: keys.privateKey[keys.privateKey.length - 1 - nodeIndex],
        sharesTokenName: `LocalNode${nodeIndex}`,
        sharesTokenSymbol: `LN${nodeIndex}`,
    };

    return blockchainConfig;
}

function generateHttpClientConfig(templateHttpClientConfig, nodeIndex) {
    const httpClientConfig = JSON.parse(JSON.stringify(templateHttpClientConfig));

    httpClientConfig.implementation['express-http-client'].config.port = 8900 + nodeIndex;

    return httpClientConfig;
}

function generateNetworkConfig(templateNetworkConfig, nodeIndex) {
    const networkConfig = JSON.parse(JSON.stringify(templateNetworkConfig));

    networkConfig.implementation['libp2p-service'].config.port = 9100 + nodeIndex;
    if (nodeIndex == 0) {
        networkConfig.implementation['libp2p-service'].config.privateKey =
            libp2pBootstrapPrivateKey;
    }

    return networkConfig;
}

function generateRepositoryConfig(templateRepositoryConfig, nodeIndex) {
    const repositoryConfig = JSON.parse(JSON.stringify(templateRepositoryConfig));

    repositoryConfig.implementation[
        'sequelize-repository'
    ].config.database = `operationaldb${nodeIndex}`;

    return repositoryConfig;
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
