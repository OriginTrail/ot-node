const path = require('path');

const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');

/**
 * Handles new offer from the DH side
 */
class DHOfferHandleCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.transport = ctx.transport;
        this.commandExecutor = ctx.commandExecutor;
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
            async_enabled: true,
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

        if (response.status === 'acknowledge') {
            this.logger.notify(`Replication request for ${offerId} sent to ${dcNodeId}. Acknowledgement received.`);

            return {
                commands: [
                    {
                        name: 'dhReplicationTimeoutCommand',
                        delay: this.config.dc_choose_time,
                        data: {
                            offerId,
                            dcNodeId,
                        },
                    },
                ],
            };
        }

        this.logger.notify(`Replication request for ${offerId} sent to ${dcNodeId}. Response received.`);

        const cacheDirectory = path.join(this.config.appDataPath, 'import_cache');

        await Utilities.writeContentsToFile(
            cacheDirectory,
            offerId,
            JSON.stringify({
                otJson: response.otJson,
                permissionedData: response.permissionedData,
            }),
        );

        const packedResponse = DHOfferHandleCommand._stripResponse(response);
        Object.assign(packedResponse, {
            dcNodeId,
            documentPath: path.join(cacheDirectory, offerId),
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
