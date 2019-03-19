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

        if (response.status === 'fail') {
            const bid = await Models.bids.findOne({
                where: {
                    offer_id: offerId,
                },
            });

            bid.status = 'FAILED';
            let message = `Failed to receive replication from ${dcNodeId} for offer ${offerId}.`;
            if (response.message != null) {
                message = `${message} Data creator reason: ${response.message}`;
            }

            bid.message = message;
            await bid.save({ fields: ['status', 'message'] });
            this.logger.warn(message);
            return Command.empty();
        }

        const bid = await Models.bids.findOne({
            where: { offer_id: offerId },
        });
        bid.status = 'SENT';
        await bid.save({ fields: ['status'] });

        this.logger.notify(`Replication request for ${offerId} sent to ${dcNodeId}. Response received.`);

        const packedResponse = DHOfferHandleCommand._stripResponse(response);
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
    static _stripResponse(response) {
        return {
            offerId: response.offer_id,
            dataSetId: response.data_set_id,
            edges: response.edges,
            litigationVertices: response.litigation_vertices,
            dcWallet: response.dc_wallet,
            litigationPublicKey: response.litigation_public_key,
            distributionPublicKey: response.distribution_public_key,
            distributionPrivateKey: response.distribution_private_key,
            distributionEpkChecksum: response.distribution_epk_checksum,
            litigationRootHash: response.litigation_root_hash,
            distributionRootHash: response.distribution_root_hash,
            distributionEpk: response.distribution_epk,
            distributionSignature: response.distribution_signature,
            transactionHash: response.transaction_hash,
            encColor: response.color,
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
