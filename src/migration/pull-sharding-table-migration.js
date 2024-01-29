import BaseMigration from './base-migration.js';

class PullBlockchainShardingTableMigration extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        repositoryModuleManager,
        blockchainModuleManager,
        hashingService,
    ) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
        this.hashingService = hashingService;
    }

    async executeMigration() {
        const promises = this.blockchainModuleManager
            .getImplementationNames()
            .map(async (blockchainId) => {
                this.logger.debug(
                    `Removing nodes from local sharding table for blockchain ${blockchainId}.`,
                );
                await this.repositoryModuleManager.removeShardingTablePeerRecords(blockchainId);

                const shardingTableLength =
                    await this.blockchainModuleManager.getShardingTableLength(blockchainId);
                let startingIdentityId = await this.blockchainModuleManager.getShardingTableHead(
                    blockchainId,
                );
                const pageSize = 10;
                const shardingTable = [];

                this.logger.debug(
                    `Started pulling ${shardingTableLength} nodes from blockchain sharding table.`,
                );

                let sliceIndex = 0;

                while (shardingTable.length < shardingTableLength) {
                    // eslint-disable-next-line no-await-in-loop
                    const nodes = await this.blockchainModuleManager.getShardingTablePage(
                        blockchainId,
                        startingIdentityId,
                        pageSize,
                    );
                    shardingTable.push(
                        ...nodes.slice(sliceIndex).filter((node) => node.nodeId !== '0x'),
                    );
                    sliceIndex = 1;
                    startingIdentityId = nodes[nodes.length - 1].identityId;
                }

                this.logger.debug(
                    `Finished pulling ${shardingTable.length} nodes from blockchain sharding table.`,
                );

                await this.repositoryModuleManager.createManyPeerRecords(
                    await Promise.all(
                        shardingTable.map(async (peer) => {
                            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                                blockchainId,
                                peer.nodeId,
                            );

                            const sha256 = await this.hashingService.callHashFunction(1, nodeId);

                            const cleanHexString = sha256.startsWith('0x')
                                ? sha256.slice(2)
                                : sha256;
                            const sha256Blob = Buffer.from(cleanHexString, 'hex');

                            return {
                                peerId: nodeId,
                                blockchainId,
                                ask: this.blockchainModuleManager.convertFromWei(
                                    blockchainId,
                                    peer.ask,
                                    'ether',
                                ),
                                stake: this.blockchainModuleManager.convertFromWei(
                                    blockchainId,
                                    peer.stake,
                                    'ether',
                                ),
                                sha256,
                                sha256Blob,
                            };
                        }),
                    ),
                );
            });

        await Promise.all(promises);
    }
}

export default PullBlockchainShardingTableMigration;
