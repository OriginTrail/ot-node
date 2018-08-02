const Models = require('../../../models/index');
const Command = require('../command');

/**
 * Saves generated parameters to the DB
 */
class DHOfferReplicationParametersSaveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.network = ctx.network;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            importId, publicKey, distributionPublicKey,
            distributionPrivateKey, epk,
        } = command.data;

        const bid = await Models.bids.findOne({ where: { import_id: importId } });

        // Store holding information and generate keys for eventual data replication.
        const holdingData = await Models.holding_data.create({
            id: importId,
            source_wallet: bid.dc_wallet,
            data_public_key: publicKey,
            distribution_public_key: distributionPublicKey,
            distribution_private_key: distributionPrivateKey,
            epk,
        }, { transaction });

        if (!holdingData) {
            this.logger.warn('Failed to store holding data info.');
        }

        this.logger.important('Replication finished. Send data to DC for verification.');
        this.remoteControl.dhReplicationFinished('Replication finished. Sending data to DC for verification.');
        await this.network.kademlia().verifyImport({
            epk,
            importId,
            encryptionKey: distributionPrivateKey,
        }, bid.dc_id);
        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferReplicationParametersSaveCommand',
            delay: 0,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferReplicationParametersSaveCommand;
