const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config('.env');

const numberOfNodes = process.argv.length === 4 ? parseInt(process.argv[2], 10) : 4;
const hostIp = process.argv.length === 4 ? process.argv[3] : null;

console.log(`Host IP ${hostIp}`);

const templatePath = './tools/windows-wsl-local-node-config/dh_node_config_template';
const bootstrapTemplatePath = './tools/windows-wsl-local-node-config/bootstrap_node_template';

const template = JSON.parse(fs.readFileSync(templatePath));
const bootstrapTemplate = JSON.parse(fs.readFileSync(bootstrapTemplatePath));

console.log('Preparing keys for blockchain');

if (!process.env.PRIVATE_KEY || !process.env.PUBLIC_KEY) {
    console.log('Missing blockchain keys in .env file');
    process.exit(1);
}

template.blockchain[0].publicKey = process.env.PUBLIC_KEY;
template.blockchain[0].privateKey = process.env.PRIVATE_KEY;

bootstrapTemplate.blockchain[0].publicKey = process.env.PUBLIC_KEY;
bootstrapTemplate.blockchain[0].privateKey = process.env.PRIVATE_KEY;
if (hostIp) {
    const ipWhitelist = ['127.0.0.1', '::1', hostIp];
    bootstrapTemplate.ipWhitelist = ipWhitelist;
    template.ipWhitelist = ipWhitelist;
}

fs.writeFileSync('./tools/windows-wsl-local-node-config/.bootstrap_origintrail_noderc', JSON.stringify(bootstrapTemplate, null, 2));

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

    const configPath = path.join(`./tools/windows-wsl-local-node-config/.dh${i}_origintrail_noderc`);
    execSync(`touch ${configPath}`);

    const parsedTemplate = JSON.parse(JSON.stringify(template));

    parsedTemplate.rpcPort = 8900 + i;
    parsedTemplate.network.port = 9000 + i;

    fs.writeFileSync(`${configPath}`, JSON.stringify(parsedTemplate, null, 2));
}
