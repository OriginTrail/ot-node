import Command from '../command.js';
import { SHARDING_TABLE_CHECK_COMMAND_FREQUENCY_MINUTES } from '../../constants/constants.js';

class ShardingTableCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.hashingService = ctx.hashingService;
    }

    /**
     * Checks sharding table size on blockchain and compares to local
     * If not equal, removes local and pulls new from blockchain
     * @param command
     */
    async execute() {
        try {
            const promises = this.blockchainModuleManager
                .getImplementationNames()
                .map(async (blockchainId) => {
                    this.logger.debug(
                        `Performing sharding table check for blockchain ${blockchainId}.`,
                    );
                    const shardingTableLength =
                        await this.blockchainModuleManager.getShardingTableLength(blockchainId);
                    const totalNodesNumber = await this.repositoryModuleManager.getPeersCount(
                        blockchainId,
                    );

                    if (shardingTableLength !== totalNodesNumber) {
                        this.logger.debug(
                            `Sharding table check for blockchain ${blockchainId} - difference between local sharding table 
                        (${totalNodesNumber} nodes) and blockchain sharding table (${shardingTableLength} nodes).`,
                        );
                        this.logger.debug(
                            `Removing nodes from local sharding table for blockchain ${blockchainId}.`,
                        );
                        await this.repositoryModuleManager.removeShardingTablePeerRecords(
                            blockchainId,
                        );

                        let startingIdentityId =
                            await this.blockchainModuleManager.getShardingTableHead(blockchainId);
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

                                    const sha256 = await this.hashingService.callHashFunction(
                                        1,
                                        nodeId,
                                    );

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
                                    };
                                }),
                            ),
                        );
                    }
                });

            await Promise.all(promises);
        } catch (error) {
            await this.handleError(error.message);
        }
        return Command.repeat();
    }

    async recover(command) {
        await this.handleError(command.message);

        return Command.repeat();
    }

    async handleError(errorMessage) {
        this.logger.error(`Error in sharding table check command: ${errorMessage}`);
    }

    /**
     * Builds default shardingTableCheckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'shardingTableCheckCommand',
            delay: 0,
            data: {},
            period: SHARDING_TABLE_CHECK_COMMAND_FREQUENCY_MINUTES * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ShardingTableCheckCommand;
