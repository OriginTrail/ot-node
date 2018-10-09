const Command = require('../command');
const Models = require('../../../models/index');
const Utilities = require('../../Utilities');

const BN = require('bn.js');

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
        this.logger.important(`Offer with internal ID ${internalOfferId} for data set ${dataSetId} written to blockchain. Waiting for DHs...`);

        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'PUBLISHED';
        offer.message = 'Offer has been published to Blockchain';
        await offer.save({ fields: ['status', 'message'] });

        const { data } = command;
        return this.continueSequence(this.pack(data), command.sequence);
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            dataSetId: Utilities.normalizeHex(data.dataSetId.toString('hex')),
            dataRootHash: Utilities.normalizeHex(data.dataRootHash.toString('hex')),
            redLitigationHash: Utilities.normalizeHex(data.redLitigationHash.toString('hex')),
            greenLitigationHash: Utilities.normalizeHex(data.greenLitigationHash.toString('hex')),
            blueLitigationHash: Utilities.normalizeHex(data.blueLitigationHash.toString('hex')),
            holdingTimeInMinutes: data.holdingTimeInMinutes.toString(),
            tokenAmountPerHolder: data.tokenAmountPerHolder.toString(),
            dataSizeInBytes: data.dataSizeInBytes.toString(),
            litigationIntervalInMinutes: data.litigationIntervalInMinutes.toString(),
        });
        return data;
    }

    /**
     * Unpack data from database
     * @param data
     * @returns {Promise<*>}
     */
    unpack(data) {
        const parsed = data;
        Object.assign(parsed, {
            dataSetId: new BN(Utilities.denormalizeHex(data.dataSetId), 16),
            dataRootHash: new BN(Utilities.denormalizeHex(data.dataRootHash), 16),
            redLitigationHash: new BN(Utilities.denormalizeHex(data.redLitigationHash), 16),
            greenLitigationHash: new BN(Utilities.denormalizeHex(data.greenLitigationHash), 16),
            blueLitigationHash: new BN(Utilities.denormalizeHex(data.blueLitigationHash), 16),
            holdingTimeInMinutes: new BN(data.holdingTimeInMinutes, 10),
            tokenAmountPerHolder: new BN(data.tokenAmountPerHolder, 10),
            dataSizeInBytes: new BN(data.dataSizeInBytes, 10),
            litigationIntervalInMinutes: new BN(data.litigationIntervalInMinutes, 10),
        });
        return parsed;
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
