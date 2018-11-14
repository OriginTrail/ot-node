const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Handles new offer from the DH side
 */
class DHOfferHandleCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.transport = ctx.transport;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            dcNodeId,
        } = command.data;

        this.logger.trace(`Sending replication request for offer ${offerId} to ${dcNodeId}.`);
        const response = await this.transport.replicationRequest({
            offerId,
            wallet: this.config.node_wallet,
            dhIdentity: this.config.erc725Identity,
        }, dcNodeId);

        const bid = await Models.bids.findOne({
            where: { offer_id: offerId },
        });
        bid.status = 'SENT';
        await bid.save({ fields: ['status'] });

        this.logger.notify(`Replication request for ${offerId} sent to ${dcNodeId}`);

        const packedResponse = this._parseResponse(response);
        Object.assign(packedResponse, {
            dcNodeId,
        });
        return {
            commands: [
                {
                    name: 'dhReplicationImportCommand',
                    data: packedResponse,
                    transactional: false,
                },
            ],
        };
    }

    /**
     * Parse network response
     * @param response  - Network response
     * @private
     */
    _parseResponse(response) {
        return {
            offerId: response.payload.offer_id,
            dataSetId: response.payload.data_set_id,
            edges: response.payload.edges,
            litigationVertices: response.payload.litigation_vertices,
            dcWallet: response.payload.dc_wallet,
            litigationPublicKey: response.payload.litigation_public_key,
            distributionPublicKey: response.payload.distribution_public_key,
            distributionPrivateKey: response.payload.distribution_private_key,
            distributionEpkChecksum: response.payload.distribution_epk_checksum,
            litigationRootHash: response.payload.litigation_root_hash,
            distributionRootHash: response.payload.distribution_root_hash,
            distributionEpk: response.payload.distribution_epk,
            distributionSignature: response.payload.distribution_signature,
            transactionHash: response.payload.transaction_hash,
        };
    }

    /**
     * Try to recover command
     * @param command
     * @param err
     * @return {Promise<{commands: *[]}>}
     */
    async recover(command, err) {
        const {
            offerId,
        } = command.data;

        const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
        bid.status = 'FAILED';
        await bid.save({ fields: ['status'] });
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferHandleCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferHandleCommand;
