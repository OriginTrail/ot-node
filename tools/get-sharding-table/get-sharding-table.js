import 'dotenv/config';
import { readFile } from 'fs/promises';
import BlockchainModuleManager from '../../src/modules/blockchain/blockchain-module-manager.js';
import Logger from '../../src/logger/logger.js';

const logger = new Logger();

if (!process.argv[2]) {
    console.log('Missing argument BLOCKCHAIN');
    console.log('Usage: npm run get-sharding-table (mainnet, testnet, development, test)');
    process.exit(1);
}

(async () => {
    // after introducing multichain we can update this
    const blockchainId = null;
    const generalConfig = JSON.parse(await readFile('./config/config.json').toString());
    const defaultConfig = JSON.parse(JSON.stringify(generalConfig[process.argv[2]]));
    const blockchainModuleManager = new BlockchainModuleManager({
        config: defaultConfig,
        logger,
    });
    await blockchainModuleManager.initialize();
    const shardingTableLength = await blockchainModuleManager.getShardingTableLength(blockchainId);
    let startingIdentityId = await blockchainModuleManager.getShardingTableHead(blockchainId);
    const pageSize = 10;
    const shardingTable = [];

    this.logger.debug(
        `Started pulling ${shardingTableLength} nodes from blockchain sharding table.`,
    );

    let sliceIndex = 0;
    while (shardingTable.length < shardingTableLength) {
        // eslint-disable-next-line no-await-in-loop
        const nodes = await blockchainModuleManager.getShardingTablePage(
            blockchainId,
            startingIdentityId,
            pageSize,
        );
        shardingTable.push(...nodes.slice(sliceIndex).filter((node) => node.nodeId !== '0x'));
        sliceIndex = 1;
        startingIdentityId = nodes[nodes.length - 1].identityId;
    }

    this.logger.debug(
        `Finished pulling ${shardingTable.length} nodes from blockchain sharding table.`,
    );
})();
