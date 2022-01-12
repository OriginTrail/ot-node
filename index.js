const fs = require('fs-extra');
const path = require('path');
const appRootPath = require('app-root-path');
const { exec, execSync } = require('child_process');
const OTNode = require('./ot-node');
const Libp2p = require('./external/libp2p-service');
const KadIdentityRanking = require('./external/kad-identity-ranking-service');
const GraphDB = require('./external/graphdb-service');
const MarkleValidation = require('./external/merkle-validation-service');
const Blockchain = require('./external/web3-blockchain-service');
const pjson = require('./package.json');
const rc = require('rc');

const configjson = require('./config/config.json');

let config = JSON.parse(fs.readFileSync('./.origintrail_noderc', 'utf8'));
const defaultConfig = JSON.parse(JSON.stringify(configjson[
    process.env.NODE_ENV &&
    ['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) >= 0 ?
        process.env.NODE_ENV : 'development']));

config = rc(pjson.name, defaultConfig);

if (!config.blockchain[0].hubContractAddress && config.blockchain[0].networkId === defaultConfig.blockchain[0].networkId) {
    config.blockchain[0].hubContractAddress = configjson[
        process.env.NODE_ENV &&
        ['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) >= 0 ?
            process.env.NODE_ENV : 'development'].blockchain[0].hubContractAddress;
}

(async () => {
    try {
        const node = new OTNode({
            autoUpdate: config.autoUpdate,
            rpcPort: config.rpcPort,
            whitelist: config.ipWhitelist,
            network: {
                implementation: new Libp2p({
                    bootstrapMultiAddress: config.network.bootstrap,
                }),
                ranking: {
                    'kad-identity': new KadIdentityRanking(),
                },
            },
            data: new GraphDB({
                repositoryName: 'node0',
                username: config.graphDatabase.username,
                password: config.graphDatabase.password,
            }),
            validation: new MarkleValidation(),
            blockchain: new Blockchain({
                networkId: config.blockchain[0].networkId,
                hubContractAddress: config.blockchain[0].hubContractAddress,
                publicKey: config.blockchain[0].publicKey,
                privateKey: config.blockchain[0].privateKey,
                rpcEndpoints: config.blockchain[0].rpcEndpoints,
            }),
            telemetryHub: config.telemetryHub,
            logLevel: config.logLevel,
            replicationFactor: 3,
            modules: config.modules,
        });
        await node.start();
    } catch (e) {
        console.error(`Error occurred while starting new version, error message: ${e}`);
        if (!config.autoUpdate.enabled) {
            console.log('Auto update is disabled. Shutting down the node...');
            process.exit(1);
        }

        const backupCode = `${config.autoUpdate.backupDirectory}/AutoGitUpdate/backup`;
        if (fs.ensureDir(backupCode)) {
            console.log('Starting back old version of OT-Node.');

            const source = path.join(config.autoUpdate.backupDirectory, 'AutoGitUpdate', 'backup');
            const destination = appRootPath.path;
            await fs.ensureDir(destination);
            await fs.copy(source, destination);

            await new Promise((resolve, reject) => {
                const command = `cd ${destination} && npm install`;
                const child = exec(command);

                // Wait for results
                child.stdout.on('end', resolve);
                child.stdout.on('data', data => console.log(`Auto Git Update - npm install: ${data.replace(/\r?\n|\r/g, '')}`));
                child.stderr.on('data', (data) => {
                    if (data.toLowerCase().includes('error')) {
                        // npm passes warnings as errors, only reject if "error" is included
                        data = data.replace(/\r?\n|\r/g, '');
                        console.error('Auto Git Update - Error installing dependencies');
                        console.error(`Auto Git Update - ${data}`);
                        reject();
                    } else {
                        console.log(`Auto Git Update - ${data}`);
                    }
                });
            });
            execSync(`cd ${destination} && npx sequelize --config=./config/sequelizeConfig.js db:migrate`, { stdio: 'inherit' });
            process.exit(1);
        } else {
            console.error(`Failed to start OT-Node, no backup code available. Error message: ${e.message}`);
            process.exit(1);
        }
    }
})();
