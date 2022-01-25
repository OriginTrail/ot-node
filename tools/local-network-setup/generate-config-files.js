const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const template = JSON.parse(fs.readFileSync('./.dh_origintrail_noderc'));

const path_to_node = path.join(__dirname, '../');
const number_of_nodes = process.argv.length === 3 ? parseInt(process.argv[2], 10) : 4;

console.log(`Generating ${number_of_nodes} total nodes`);

for (let i = 0; i < number_of_nodes; i += 1) {
    let node_name;
    if (i === 0) {
        console.log('Using the preexisting identity for the first node (bootstrap)');
        node_name = 'bootstrap';
        continue;
    } else {
        node_name = `DH${i}`;
    }
    console.log(`Configuring node ${node_name}`);

    const configPath = path.join(`./.dh${i}_origintrail_noderc`);
    execSync(`touch ${configPath}`);

    const parsedTemplate = JSON.parse(JSON.stringify(template));

    parsedTemplate.rpcPort = 8900 + i;
    parsedTemplate.network.port = 9000 + i;

    fs.writeFileSync(`${configPath}`, JSON.stringify(parsedTemplate, null, 2));
}
