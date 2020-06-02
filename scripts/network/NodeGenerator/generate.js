const fs = require('fs');
const { execSync } = require('child_process');

const wallets = require('./wallets');
const template = require('./template');


let n = 4;

if (process.argv.length > 2) {
    n = Math.min(parseInt(process.argv[2], 10), 10);
}

try {
    execSync('rm -rf ../../../../config-files');
} catch (e) {console.log(e);}
execSync('mkdir ../../../../config-files');

for (let i = 1; i <= n; i += 1) {
    let nodeType = `DHG${i - 1}`;
    const parsedTemplate = JSON.parse(JSON.stringify(template));
    if (i === 1) {
        nodeType = 'DCG';
    }

    console.log(`Configuring node ${nodeType}`);

    let configDir = `../../../../config-files/${nodeType}-config`;
    let filename = `../../../../config-files/${nodeType}.json`;
    parsedTemplate.node_wallet = wallets[i].wallet;
    parsedTemplate.node_private_key = wallets[i].privateKey;
    parsedTemplate.management_wallet = wallets[i].wallet;
    parsedTemplate.node_rpc_port = 8900 + (i - 1);
    parsedTemplate.node_port = 5278 + (i - 1);
    parsedTemplate.node_remote_control_port = 3000 + (i - 1);
    parsedTemplate.control_port = 5880 + (i - 1);
    parsedTemplate.database.database = `origintrail-${nodeType}`;
    //parsedTemplate.network.bootstraps.push();
    if (nodeType === 'DCG') {
        parsedTemplate.network.bootstraps = [];
    }
    execSync(`touch ${filename}`);
    fs.writeFileSync(`${filename}`, JSON.stringify(parsedTemplate, null, 2));
    execSync(`mkdir ${configDir}`);
    //
    configDir = `../config-files/${nodeType}-config`;
    filename = `../config-files/${nodeType}.json`;

    execSync(`cd ../../../../ot-node && npm run setup:hard -- --configDir=${configDir} --config=${filename}`);
    if (nodeType === 'DCG') {
        configDir = `../../../../config-files/${nodeType}-config`;

        execSync(`cp kademlia.crt ${configDir}/kademlia.crt`);
        execSync(`cp kademlia.key ${configDir}/kademlia.key`);
        execSync(`cp identity.json ${configDir}/identity.json`);
    }
}
