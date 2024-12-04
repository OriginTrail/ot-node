import Command from '../command.js';
import {
    COMMAND_PRIORITY,
    SHARDING_TABLE_CHECK_COMMAND_FREQUENCY_MILLS,
} from '../../constants/constants.js';

class ShardingTableCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
    }

    /**
     * Checks sharding table size on blockchain and compares to local
     * If not equal, removes local and pulls new from blockchain
     * @param command
     */
    async execute() {
        const repositoryTransaction = await this.repositoryModuleManager.transaction();

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
                        return this.shardingTableService.pullBlockchainShardingTable(
                            blockchainId,
                            repositoryTransaction,
                        );
                    }
                });

            await Promise.all(promises);
            await repositoryTransaction.commit();
        } catch (error) {
            await repositoryTransaction.rollback();
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
            period: SHARDING_TABLE_CHECK_COMMAND_FREQUENCY_MILLS,
            priority: COMMAND_PRIORITY.HIGHEST,
            isBlocking: true,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ShardingTableCheckCommand;
