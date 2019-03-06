const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');
const models = require('../../../models/index');

/**
 * Creates offer in the database
 */
class DCOfferCreateDbCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            internalOfferId,
            redLitigationHash,
            blueLitigationHash,
            greenLitigationHash,
            holdingTimeInMinutes,
            tokenAmountPerHolder,
            litigationIntervalInMinutes,
        } = command.data;

        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.holding_time_in_minutes = holdingTimeInMinutes.toString();
        offer.token_amount_per_holder = tokenAmountPerHolder.toString();
        offer.red_litigation_hash = redLitigationHash.toString('hex');
        offer.blue_litigation_hash = blueLitigationHash.toString('hex');
        offer.green_litigation_hash = greenLitigationHash.toString('hex');
        offer.litigation_interval_in_minutes = litigationIntervalInMinutes.toString();
        offer.message = 'Offer has been prepared for BC.';
        offer.status = 'PREPARED';

        await offer.save({
            fields: [
                'holding_time_in_minutes', 'token_amount_per_holder',
                'red_litigation_hash', 'blue_litigation_hash', 'green_litigation_hash',
                'litigation_interval_in_minutes', 'message', 'status'],
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
        const { internalOfferId } = command.data;
        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message', 'global_status'] });

        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            dataSetId: Utilities.normalizeHex(data.dataSetId.toString('hex').padStart(64, '0')),
            dataRootHash: Utilities.normalizeHex(data.dataRootHash.toString('hex').padStart(64, '0')),
            redLitigationHash: Utilities.normalizeHex(data.redLitigationHash.toString('hex').padStart(64, '0')),
            greenLitigationHash: Utilities.normalizeHex(data.greenLitigationHash.toString('hex').padStart(64, '0')),
            blueLitigationHash: Utilities.normalizeHex(data.blueLitigationHash.toString('hex').padStart(64, '0')),
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
     * Builds default dcOfferCreateDbCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferCreateDbCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferCreateDbCommand;
