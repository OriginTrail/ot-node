const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const keys = require('./keys.json');

const numberOfNodes = process.argv.length === 3 ? parseInt(process.argv[2], 10) : 4;

const templatePath = './tools/local-network-setup/.dh_origintrail_noderc';
const bootstrapTemplatePath = './tools/local-network-setup/.bootstrap_origintrail_noderc';

const template = JSON.parse(fs.readFileSync(templatePath));
const bootstrapTemplate = JSON.parse(fs.readFileSync(bootstrapTemplatePath));

console.log('Preparing keys for blockchain');

if (!keys) {
    console.log('Missing blockchain keys');
    process.exit(1);
}

for (const implementation in bootstrapTemplate.modules.blockchain.implementation) {
    bootstrapTemplate.modules.blockchain.implementation[implementation].config.publicKey =
        keys.publicKey[0];
    bootstrapTemplate.modules.blockchain.implementation[implementation].config.privateKey =
        keys.privateKey[0];
    bootstrapTemplate.modules.blockchain.implementation[implementation].config.managementKey =
        keys.managementKey;
}

fs.writeFileSync(bootstrapTemplatePath, JSON.stringify(bootstrapTemplate, null, 2));

console.log(`Generating ${numberOfNodes} total nodes`);

for (let i = 0; i < numberOfNodes; i += 1) {
    let nodeName;
    if (i === 0) {
        console.log('Using the preexisting identity for the first node (bootstrap)');
        nodeName = 'bootstrap';
        continue;
    } else {
        nodeName = `DH${i}`;
    }
    console.log(`Configuring node ${nodeName}`);

    const configPath = path.join(`./tools/local-network-setup/.dh${i}_origintrail_noderc`);
    execSync(`touch ${configPath}`);

    const parsedTemplate = JSON.parse(JSON.stringify(template));

    const polygonEndpoints = [
        'wss://polygon-mumbai.g.alchemy.com/v2/HWQYg3FX49VALP0FMMZxKhZDVrIRDiMo',
        'wss://polygon-mumbai.g.alchemy.com/v2/A5XW59zlZH8Q4NYvHPOByry6RpYHVsZG',
        'wss://polygon-mumbai.g.alchemy.com/v2/pjhHpEpgUyQcKde6lZGNK9i5DStsfg8P',
        'wss://polygon-mumbai.g.alchemy.com/v2/PS344yOFOjNVjy7l4HywB824lD-tELBj',
        'wss://polygon-mumbai.g.alchemy.com/v2/o1tqYf3FW4dFZMhKw5Pjrv1M9grn485F',
    ];

    for (const implementation in parsedTemplate.modules.blockchain.implementation) {
        if (implementation === 'polygon') {
            parsedTemplate.modules.blockchain.implementation[implementation].config.rpcEndpoints = [
                polygonEndpoints[i - 1],
                'https://matic-mumbai.chainstacklabs.com',
                'https://rpc-mumbai.matic.today',
                'https://matic-testnet-archive-rpc.bwarelabs.com',
            ];
        }
        parsedTemplate.modules.blockchain.implementation[implementation].config.publicKey =
            keys.publicKey[i + 1];
        parsedTemplate.modules.blockchain.implementation[implementation].config.privateKey =
            keys.privateKey[i + 1];
        parsedTemplate.modules.blockchain.implementation[implementation].config.managementKey =
            keys.managementKey;
    }

    parsedTemplate.modules.httpClient.implementation['express-http-client'].config.port = 8900 + i;
    parsedTemplate.modules.network.implementation['libp2p-service'].config.port = 9000 + i;
    parsedTemplate.modules.repository.implementation[
        'sequelize-repository'
    ].config.database = `operationaldb${i}`;
    parsedTemplate.modules.tripleStore.implementation[
        'ot-graphdb'
    ].config.repository = `repository${i}`;
    parsedTemplate.appDataPath = `data${i}`;

    if (process.env.LOG_LEVEL) {
        parsedTemplate.logLevel = process.env.LOG_LEVEL;
    }

    fs.writeFileSync(`${configPath}`, JSON.stringify(parsedTemplate, null, 2));
}
