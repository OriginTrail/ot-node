const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');
const BN = require('bn.js');
const path = require('path');
const Utilities = require('../../Utilities');
const { fork } = require('child_process');

/**
 * Prepare offer parameters (litigation/distribution hashes, etc.)
 */
class DCOfferPrepareCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
        this.commandExecutor = ctx.commandExecutor;

        this.dcService = ctx.dcService;
        this.importService = ctx.importService;
        this.pricingService = ctx.pricingService;
        this.profileService = ctx.profileService;
        this.errorNotificationService = ctx.errorNotificationService;

        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            dataSetId, dataSizeInBytes, handler_id, blockchain_id,
        } = command.data;

        if (!command.data.holdingTimeInMinutes) {
            command.data.holdingTimeInMinutes = this.config.dc_holding_time_in_minutes;
        }

        const { dc_price_factor } = this.blockchain.getPriceFactors(blockchain_id).response;

        let offerPrice = {};
        if (!command.data.tokenAmountPerHolder) {
            offerPrice = await this.pricingService
                .calculateOfferPriceinTrac(
                    dataSizeInBytes,
                    command.data.holdingTimeInMinutes,
                    dc_price_factor,
                    blockchain_id,
                );
            command.data.tokenAmountPerHolder = offerPrice.finalPrice;
        }

        const offer = await Models.offers.create({
            data_set_id: dataSetId,
            blockchain_id,
            message: 'Offer is pending',
            status: 'PENDING',
            global_status: 'PENDING',
            trac_in_eth_used_for_price_calculation: offerPrice.tracInEth,
            gas_price_used_for_price_calculation: offerPrice.gasPriceInGwei,
            price_factor_used_for_price_calculation: dc_price_factor,
        });

        if (!command.data.litigationIntervalInMinutes) {
            command.data.litigationIntervalInMinutes =
                new BN(this.config.dc_litigation_interval_in_minutes, 10);
        }

        if (this.config.parentIdentity) {
            const hasPermission = await this.profileService.hasParentPermission();
            if (!hasPermission) {
                const message = 'Identity does not have permission to use parent identity funds. To replicate data please acquire permissions or remove parent identity from config';
                this.logger.warn(message);
                throw new Error(message);
            }

            const hasFunds = await this.dcService
                .parentHasProfileBalanceForOffer(command.data.tokenAmountPerHolder);
            if (!hasFunds) {
                const message = 'Parent profile does not have enough tokens. To replicate data please deposit more tokens to your profile';
                this.logger.warn(message);
                throw new Error(message);
            }
        } else {
            const hasFunds = await this.dcService
                .hasProfileBalanceForOffer(command.data.tokenAmountPerHolder, blockchain_id);
            if (!hasFunds) {
                const message = 'Not enough tokens. To replicate data please deposit more tokens to your profile';
                this.logger.warn(message);
                throw new Error(message);
            }
        }

        const handler_data = {
            status: 'PREPARING_OFFER',
            offer_id: offer.id,
        };
        await Models.handler_ids.update({
            data: JSON.stringify(handler_data),
        }, {
            where: {
                handler_id,
            },
        });
        command.data.internalOfferId = offer.id;

        // export dataset from db
        this.logger.info(`Exporting dataset: ${dataSetId}. For internal offer id: ${offer.id}.`);
        const fileContent = await this.importService.getImportDbData(dataSetId);
        const cacheDirectoryPath = path.join(
            this.config.appDataPath,
            this.config.dataSetStorage, offer.id,
        );

        await Utilities.writeContentsToFile(
            cacheDirectoryPath,
            handler_id,
            JSON.stringify(fileContent),
        );

        const forked = fork('modules/worker/create-replication-data-worker.js');
        this.logger.info(`Preparing data for offer with internal id: ${offer.id}, started.`);
        forked.send(JSON.stringify({
            internalOfferId: offer.id,
            handler_id,
            cacheDirectoryPath,
            config: this.config,
            dataSetId,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                throw new Error(response.error);
            } else {
                this.logger.info(`Preparing data for offer with internal id: ${offer.id}, completed successfully.`);
                const distLitRootHashes = response.hashes;
                const { data } = command;
                Object.assign(data, distLitRootHashes);
                await this.commandExecutor.add({
                    name: command.sequence[0],
                    sequence: command.sequence.slice(1),
                    delay: 0,
                    data,
                    transactional: false,
                });
            }
            forked.kill();
        });

        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { internalOfferId, handler_id } = command.data;
        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message', 'global_status'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });
        Models.handler_ids.update({
            status: 'FAILED',
        }, { where: { handler_id } });

        this.errorNotificationService.notifyError(
            err,
            {
                offerId: offer.offer_id,
                blockchain_id: offer.blockchain_id,
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
     * Builds default dcOfferPrepareCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferPrepareCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferPrepareCommand;
