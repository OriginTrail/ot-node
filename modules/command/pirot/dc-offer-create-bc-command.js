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
        } = command.data;

        await this.blockchain.createOffer(
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
        this.logger.important(`Offer with internal ID ${internalOfferId} for data set ${dataSetId} written to blockchain. Waiting for DHs...`);

        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'PUBLISHED';
        offer.message = 'Offer has been published to Blockchain';
        await offer.save({ fields: ['status', 'message'] });

        const { data } = command;
        return this.continueSequence(this.pack(data), command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { offerId } = command.data;
        const offer = await Models.offers.findOne({ where: { id: offerId } });
        offer.status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message'] });
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
