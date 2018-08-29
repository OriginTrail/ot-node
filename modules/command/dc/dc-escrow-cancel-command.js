const Command = require('../command');

/**
 * Cancels Escrow on blockchain
 */
class DCEscrowCancelCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.network = ctx.network;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { importId, dhWallet, dhNodeId } = command.data;
        await this.blockchain.cancelEscrow(
            dhWallet,
            importId,
            false,
        );
        await this.network.kademlia().sendVerifyImportResponse({
            status: 'fail',
            import_id: importId,
        }, dhNodeId);
        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcEscrowCancelCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCEscrowCancelCommand;
