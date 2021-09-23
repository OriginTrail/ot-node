const path = require('path');

const Command = require('../command');
const Models = require('../../../models');
const constants = require('../../constants');

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
        this.profileService = ctx.profileService;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            blockchain_id,
            dcNodeId,
        } = command.data;

        const { node_wallet } = this.blockchain.getWallet(blockchain_id).response;
        const bid = await Models.bids.findOne({
            where: {
                offer_id: offerId,
                blockchain_id,
            },
        });
        if (bid && (bid.status === 'FAILED' || bid.status === 'SENT')) {
            this.logger.trace(`Replication request for offer ${offerId} already sent to node ${dcNodeId}.`);
            return Command.empty();
        }
        this.logger.trace(`Sending replication request for offer ${offerId} to node ${dcNodeId}.`);
        const response = await this.transport.replicationRequest({
            offerId,
            blockchain_id,
            wallet: node_wallet,
            dhIdentity: this.profileService.getIdentity(blockchain_id),
            async_enabled: true,
        }, dcNodeId);

        if (response.status === 'fail') {
            bid.status = 'FAILED';
            let message = `Failed to receive replication from ${dcNodeId} for offer ${offerId} on chain ${blockchain_id}.`;
            if (response.message != null) {
                message = `${message} Data creator reason: ${response.message}`;
            }

            bid.message = message;
            await bid.save({ fields: ['status', 'message'] });
            this.logger.warn(message);
            return Command.empty();
        }

        bid.status = 'SENT';
        await bid.save({ fields: ['status'] });

        this.logger.notify(`Received replication request acknowledgement for offer_id ${offerId} from node ${dcNodeId}.`);

        return {
            commands: [
                {
                    name: 'dhReplicationTimeoutCommand',
                    delay: constants.OFFER_FINALIZED_COMMAND_DEADLINE_AT,
                    data: {
                        offerId,
                        dcNodeId,
                    },
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
            dcWallet: response.dc_wallet,
            dcNodeId: response.dcNodeId,
            litigationPublicKey: response.litigation_public_key,
            litigationRootHash: response.litigation_root_hash,
            distributionPublicKey: response.distribution_public_key,
            distributionPrivateKey: response.distribution_private_key,
            distributionEpk: response.distribution_epk,
            transactionHash: response.transaction_hash,
            encColor: response.color,
            dcIdentity: response.dcIdentity,
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
