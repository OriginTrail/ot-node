/* eslint-disable */
import 'dotenv/config';
import mysql from 'mysql2';
import path from 'path';
import fs from 'fs-extra';
import graphdb from 'graphdb';
import { stat } from 'fs/promises';
import axios from 'axios';

const { server, http } = graphdb;

const numberOfNodes = parseInt(process.argv[2], 10);
const network = process.argv[3];
const tripleStoreImplementation = process.argv[4];
const hubContractAddress = process.argv[5];

const dhTemplatePath = './tools/local-network-setup/.dh_origintrail_noderc_template';
const bootstrapTemplatePath = './tools/local-network-setup/.bootstrap_origintrail_noderc_template';

const generalConfig = JSON.parse(fs.readFileSync('./config/config.json'));
const keys = JSON.parse(fs.readFileSync('./tools/local-network-setup/keys.json'));

console.log('Preparing keys for blockchain');

if (!keys) {
    console.log('Missing blockchain keys');
    process.exit(1);
}

console.log(`Generating ${numberOfNodes} total nodes`);

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
    console.log(`Configuring node ${nodeName}`);

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
    await deleteTripleStoreRepositories(config.modules.tripleStore);
}

async function dropDatabase(name, config) {
    console.log(`Dropping database: ${name}`);
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
        console.log(`Error while dropping database. Error: ${e.message}`);
    }
    connection.destroy();
}

async function deleteTripleStoreRepositories(moduleConfig) {
    for (const [implementationName, implementationConfig] of Object.entries(
        moduleConfig.implementation,
    )) {
        if (implementationConfig.enabled) {
            switch (implementationName) {
                case 'ot-graphdb':
                    await deleteGraphdbRepositories(implementationConfig.config);
                    break;
                case 'ot-blazegraph':
                    await deleteBlazegraphRepositories(implementationConfig.config);
                    break;
                case 'ot-fuseki':
                    await deleteFusekiRepositories(implementationConfig.config);
                    break;
                default:
                    throw Error('unknown triple store implementation name');
            }
        }
    }
}

async function deleteGraphdbRepositories(config) {
    for (const [repository, repositoryConfig] of Object.entries(config.repositories)) {
        const { url, name } = repositoryConfig;
        console.log(`Deleting triple store repository: ${repository} with name: ${name}`);

        const serverConfig = new server.ServerClientConfig(url)
            .setTimeout(40000)
            .setHeaders({
                Accept: http.RDFMimeType.N_QUADS,
            })
            .setKeepAlive(true);
        const s = new server.GraphDBServerClient(serverConfig);
        s.deleteRepository(name).catch((e) =>
            console.log(`Error while deleting triple store repository. Error: ${e.message}`),
        );
    }
}

async function deleteBlazegraphRepositories(config) {
    for (const [repository, repositoryConfig] of Object.entries(config.repositories)) {
        const { url, name } = repositoryConfig;
        console.log(`Deleting triple store repository: ${repository} with name: ${name}`);

        await axios
            .delete(`${url}/namespace/${name}`, {})
            .catch((e) =>
                console.log(`Error while deleting triple store repository. Error: ${e.message}`),
            );
    }
}

async function deleteFusekiRepositories(config) {
    for (const [repository, repositoryConfig] of Object.entries(config.repositories)) {
        const { url, name } = repositoryConfig;
        console.log(`Deleting triple store repository: ${repository} with name: ${name}`);

        await axios
            .delete(`${url}/$/datasets?dbName=${name}`, {})
            .catch((e) =>
                console.log(`Error while deleting triple store repository. Error: ${e.message}`),
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
