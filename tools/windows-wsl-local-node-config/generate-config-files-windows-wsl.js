const PeerId = require('peer-id');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config('.env');

const dhNodeTemplatePath = './tools/windows-wsl-local-node-config/dh_node_config_template';
const bootstrapTemplatePath = './tools/windows-wsl-local-node-config/bootstrap_node_template';

async function generateConfig() {
    if (!process.env.PRIVATE_KEY || !process.env.PUBLIC_KEY) {
        console.log('Missing blockchain keys in .env file');
        process.exit(1);
    }

    const bootstrapTemplate = JSON.parse(fs.readFileSync(bootstrapTemplatePath));
    let networkPrivateKey = bootstrapTemplate.network.privateKey;

    if (!networkPrivateKey) {
        console.log('No network private key specified. Generating new network private key...');
        const id = await PeerId.create({ bits: 1024, keyType: 'RSA' });
        bootstrapTemplate.network.privateKey = id.toJSON().privKey;
        networkPrivateKey = bootstrapTemplate.network.privateKey;
    }
    console.log(`Bootstrap template network private key: ${networkPrivateKey}`);

    const peerId = await PeerId.createFromPrivKey(networkPrivateKey);
    const peerIdValue = peerId._idB58String;
    console.log(`Peer Id generated from network private key: ${peerIdValue}`);

    console.log('Preparing keys for blockchain.');
    const dhNodeTemplate = JSON.parse(fs.readFileSync(dhNodeTemplatePath));
    dhNodeTemplate.blockchain[0].publicKey = process.env.PUBLIC_KEY;
    dhNodeTemplate.blockchain[0].privateKey = process.env.PRIVATE_KEY;
    dhNodeTemplate.network.bootstrap[0] = dhNodeTemplate.network.bootstrap[0].replace('$peer-id', peerIdValue);

    bootstrapTemplate.blockchain[0].publicKey = process.env.PUBLIC_KEY;
    bootstrapTemplate.blockchain[0].privateKey = process.env.PRIVATE_KEY;

    const hostIp = process.argv.length === 4 ? process.argv[3] : null;
    console.log(`Adding Host IP ${hostIp} to whitelist`);
    if (hostIp) {
        const ipWhitelist = ['127.0.0.1', '::1', hostIp];
        bootstrapTemplate.ipWhitelist = ipWhitelist;
        dhNodeTemplate.ipWhitelist = ipWhitelist;
    }

    const numberOfNodes = process.argv.length === 4 ? parseInt(process.argv[2], 10) : 4;
    console.log(`Generating ${numberOfNodes} total nodes`);

    fs.writeFileSync('./tools/windows-wsl-local-node-config/.bootstrap_origintrail_noderc', JSON.stringify(bootstrapTemplate, null, 2));
    console.log('Configured DC node (bootstrap)');

    for (let i = 1; i < numberOfNodes; i += 1) {
        const nodeName = `DH${i}`;
        console.log(`Configuring node ${nodeName}`);

        const configPath = path.join(`./tools/windows-wsl-local-node-config/.dh${i}_origintrail_noderc`);
        execSync(`touch ${configPath}`);

        const parsedTemplate = JSON.parse(JSON.stringify(dhNodeTemplate));

        parsedTemplate.rpcPort = 8900 + i;
        parsedTemplate.network.port = 9000 + i;

        fs.writeFileSync(`${configPath}`, JSON.stringify(parsedTemplate, null, 2));
        console.log(`Configured node ${nodeName}`);
    }
}

generateConfig();
