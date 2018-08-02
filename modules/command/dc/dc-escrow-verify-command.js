const Models = require('../../../models/index');
const Command = require('../command');

/**
 * Verifies Escrow on blockchain
 */
class DCEscrowVerifyCommand extends Command {
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
        await this.blockchain.verifyEscrow(
            importId,
            dhWallet,
        );
        this.logger.important(`Holding data for offer ${importId} and contact ${dhWallet} successfully verified. Challenges taking place...`);

        const replicatedData = await Models.replicated_data.findOne({
            where: { dh_id: dhNodeId, import_id: importId },
        });

        replicatedData.status = 'ACTIVE';
        await replicatedData.save({ fields: ['status'] });

        await this.network.kademlia().sendVerifyImportResponse({
            status: 'success',
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
            name: 'dcEscrowVerifyCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCEscrowVerifyCommand;
