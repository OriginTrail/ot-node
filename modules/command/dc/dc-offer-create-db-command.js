const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');
const models = require('../../../models/index');
const constants = require('../../constants');
const path = require('path');
const fs = require('fs');

/**
 * Creates offer in the database
 */
class DCOfferCreateDbCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;

        this.profileService = ctx.profileService;

        this.remoteControl = ctx.remoteControl;
        this.errorNotificationService = ctx.errorNotificationService;
        this.permissionedDataService = ctx.permissionedDataService;
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
            urgent,
            handler_id,
            blockchain_id,
        } = command.data;

        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.holding_time_in_minutes = holdingTimeInMinutes.toString();
        offer.token_amount_per_holder = tokenAmountPerHolder.toString();
        offer.red_litigation_hash = redLitigationHash.toString('hex');
        offer.blue_litigation_hash = blueLitigationHash.toString('hex');
        offer.green_litigation_hash = greenLitigationHash.toString('hex');
        offer.litigation_interval_in_minutes = litigationIntervalInMinutes.toString();
        offer.urgent = !!urgent;
        offer.message = 'Offer has been prepared for BC.';
        offer.status = 'PREPARED';

        await offer.save({
            fields: [
                'holding_time_in_minutes', 'token_amount_per_holder',
                'red_litigation_hash', 'blue_litigation_hash', 'green_litigation_hash',
                'litigation_interval_in_minutes', 'urgent', 'message', 'status'],
        });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });
        const cacheDirectoryPath = path.join(
            this.config.appDataPath,
            this.config.dataSetStorage, internalOfferId,
        );

        const documentPath = path.join(cacheDirectoryPath, handler_id);

        const otJson = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));
        await this.permissionedDataService.addDataSellerForPermissionedData(
            offer.data_set_id,
            this.profileService.getIdentity(blockchain_id),
            blockchain_id,
            this.config.default_data_price,
            this.config.identity,
            otJson['@graph'],
        );

        const { data } = command;
        return this.continueSequence(this.pack(data), command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { internalOfferId, handler_id } = command.data;
        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message', 'global_status'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });
        models.handler_ids.update({
            status: 'FAILED',
        }, { where: { handler_id } });

        this.errorNotificationService.notifyError(
            err,
            {
                offerId: offer.offer_id,
                internalOfferId,
                tokenAmountPerHolder: offer.token_amount_per_holder,
                litigationIntervalInMinutes: offer.litigation_interval_in_minutes,
                datasetId: offer.data_set_id,
                holdingTimeInMinutes: offer.holding_time_in_minutes,
            },
            constants.PROCESS_NAME.offerHandling,
        );

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
            tokenAmountPerHolder: new BN(data.tokenAmountPerHolder.toString(), 10),
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
