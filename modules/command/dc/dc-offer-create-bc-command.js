const Command = require('../command');
const Models = require('../../../models/index');
const Utilities = require('../../Utilities');
const constants = require('../../constants');

/**
 * Creates offer on blockchain
 */
class DCOfferCreateBcCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            internalOfferId,
            dataSetId,
            dataRootHash,
            redLitigationHash,
            greenLitigationHash,
            blueLitigationHash,
            holdingTimeInMinutes,
            tokenAmountPerHolder,
            dataSizeInBytes,
            litigationIntervalInMinutes,
            handler_id,
            urgent,
        } = command.data;

        let result;

        try {
            result = await this.blockchain.createOffer(
                Utilities.normalizeHex(this.config.erc725Identity),
                dataSetId,
                dataRootHash,
                redLitigationHash,
                greenLitigationHash,
                blueLitigationHash,
                Utilities.normalizeHex(this.config.identity),
                holdingTimeInMinutes,
                tokenAmountPerHolder,
                dataSizeInBytes,
                litigationIntervalInMinutes,
                urgent,
            );
        } catch (error) {
            if (error.message.includes('Gas price higher than maximum allowed price')) {
                const delay = constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS / 60 / 1000;
                this.logger.info(`Gas price too high, delaying call for ${delay} minutes`);

                const handler = await Models.handler_ids.findOne({
                    where: { handler_id },
                });
                const handler_data = JSON.parse(handler.data);
                handler_data.status = 'DELAYED';
                handler.timestamp = Date.now();
                handler.data = JSON.stringify(handler_data);
                await handler.save({ fields: ['data', 'timestamp'] });

                const message = `Offer creation has been delayed on ${(new Date(Date.now())).toUTCString()} due to high gas price`;
                await Models.offers.update({ message }, { where: { id: internalOfferId } });

                return Command.repeat();
            }
            throw error;
        }
        this.logger.important(`Offer with internal ID ${internalOfferId} for data set ${dataSetId} written to blockchain. Waiting for DHs...`);

        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        offer.transaction_hash = result.transactionHash;
        offer.status = 'PUBLISHED';
        offer.message = 'Offer has been published to Blockchain';
        await offer.save({ fields: ['status', 'message', 'transaction_hash'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });

        await Models.handler_ids.update({ timestamp: Date.now() }, { where: { handler_id } });

        await this.blockchain.executePlugin('fingerprint-plugin', {
            dataSetId,
            dataRootHash,
        });

        const { data } = command;
        return this.continueSequence(this.pack(data), command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        return this.invalidateOffer(command, err);
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        return this.invalidateOffer(
            command,
            Error('The offer creation command is too late.'),
        );
    }

    async invalidateOffer(command, err) {
        const { dataSetId, internalOfferId, handler_id } = command.data;
        this.logger.notify(`Offer for data set ${dataSetId} has not been started. ${err.message}`);

        const errorData = {
            internalOfferId,
        };

        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        if (offer) {
            offer.status = 'FAILED';
            offer.global_status = 'FAILED';
            offer.message = `Offer for data set ${dataSetId} has not been started. ${err.message}`;
            await offer.save({ fields: ['status', 'message', 'global_status'] });

            errorData.tokenAmountPerHolder = offer.token_amount_per_holder;
            errorData.litigationIntervalInMinutes = offer.litigation_interval_in_minutes;
            errorData.datasetId = offer.data_set_id;
            errorData.holdingTimeInMinutes = offer.holding_time_in_minutes;

            await this.replicationService.cleanup(offer.id);
        } else {
            this.logger.warn(`Offer with internal id ${internalOfferId} not found in database.`);
        }

        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });

        await Models.handler_ids.update({ status: 'FAILED' }, { where: { handler_id } });

        this.errorNotificationService.notifyError(
            err,
            errorData,
            constants.PROCESS_NAME.offerHandling,
        );

        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferCreateBcCommand',
            delay: 0,
            period: constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS,
            deadline_at: Date.now() + (5 * constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferCreateBcCommand;
