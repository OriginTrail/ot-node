const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const template = JSON.parse(fs.readFileSync('./tools/local-network-setup/.dh_origintrail_noderc'));

const numberOfNodes = process.argv.length === 3 ? parseInt(process.argv[2], 10) : 4;

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

    parsedTemplate.rpcPort = 8900 + i;
    parsedTemplate.network.port = 9000 + i;

    fs.writeFileSync(`${configPath}`, JSON.stringify(parsedTemplate, null, 2));
}
