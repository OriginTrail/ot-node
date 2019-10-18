const Command = require('../command');
const Models = require('../../../models/index');
const Utilities = require('../../Utilities');

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
        } = command.data;

        const result = await this.blockchain.createOffer(
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
        );
        const offerTaskEvent = await this.blockchain.decodeOfferTaskEventFromTransaction(result);

        const { offerId, task } = offerTaskEvent;

        this.logger.important(`Offer with internal ID ${internalOfferId} for data set ${dataSetId} written to blockchain. Waiting for DHs...`);

        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        offer.offer_id = offerId;
        offer.task = task;
        offer.transaction_hash = result.transactionHash;
        offer.status = 'STARTED';
        offer.message = 'Offer has been successfully started. Waiting for DHs...';
        await offer.save({ fields: ['task', 'offer_id', 'status', 'message', 'transaction_hash'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });

        await this.blockchain.executePlugin('fingerprint-plugin', {
            dataSetId,
            dataRootHash,
        });

        const handler = await Models.handler_ids.findOne({
            where: { handler_id },
        });
        const handler_data = JSON.parse(handler.data);
        handler_data.offer_id = offer.offer_id;
        handler_data.status = 'WAITING_FOR_HOLDERS';
        await Models.handler_ids.update(
            {
                data: JSON.stringify(handler_data),
            },
            {
                where: { handler_id },
            },
        );

        this.logger.trace(`Offer successfully started for data set ${dataSetId}. Offer ID ${offerId}. Internal offer ID ${internalOfferId}.`);
        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { internalOfferId } = command.data;
        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message', 'global_status'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });

        await this.replicationService.cleanup(offer.id);
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
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferCreateBcCommand;
