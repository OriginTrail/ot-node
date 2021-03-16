const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const importUtilities = require('../../ImportUtilities');
const constants = require('../../constants');
const OtJsonUtilities = require('../../OtJsonUtilities');
/**
 * Initiates litigation from the DC side
 */
class DCLitigationInitiateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.importService = ctx.importService;
        this.challengeService = ctx.challengeService;
        this.remoteControl = ctx.remoteControl;
        this.errorNotificationService = ctx.errorNotificationService;
        this.profileService = ctx.profileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            offerId,
            blockchain_id,
            dhIdentity,
            objectIndex,
            blockIndex,
            litigationPrivateKey,
        } = command.data;

        this.logger.info(`Initiating litigation for holder ${dhIdentity} and offer ${offerId}.`);

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });

        if (offer.global_status === 'COMPLETED') {
            // offer has already been completed
            this.logger.warn(`Offer ${offerId} has already been completed. Skipping litigation for DH identity ${dhIdentity}, object index ${objectIndex} and block index ${blockIndex}`);
            return Command.empty();
        }

        if (offer.global_status === 'FAILED') {
            // offer has already been failed
            this.logger.warn(`Offer ${offerId} has already been failed. Skipping litigation for DH identity ${dhIdentity}, object index ${objectIndex} and block index ${blockIndex}`);
            return Command.empty();
        }

        const replicatedData = await models.replicated_data.findOne({
            where: { offer_id: offerId, dh_identity: dhIdentity },
        });

        if (replicatedData.status === 'PENALIZED') {
            this.logger.trace(`Holder with id: ${dhIdentity} for offer ${offerId} was already penalized`);
            return Command.empty();
        }

        if (replicatedData.status !== 'CHALLENGING') {
            // litigation or replacement is in progress
            this.logger.trace(`Litigation already in progress... It needs to be completed in order to litigate ${dhIdentity} for offer ${offerId}`);
            return Command.repeat(); // wait for offer to be active
        }

        replicatedData.status = 'LITIGATION_STARTED';
        await replicatedData.save({ fields: ['status'] });

        const dcIdentity = this.profileService.getIdentity(blockchain_id);
        const otJson = await this.importService.getImport(offer.data_set_id);
        importUtilities.removeGraphPermissionedData(otJson['@graph']);

        const encryptedDataset = importUtilities.encryptDataset(
            otJson,
            litigationPrivateKey,
        );

        let sortedDataset =
            OtJsonUtilities.prepareDatasetForGeneratingLitigationProof(encryptedDataset);
        if (!sortedDataset) {
            sortedDataset = encryptedDataset;
        }
        const merkleProof = this.challengeService.createChallengeProof(
            sortedDataset['@graph'],
            objectIndex,
            blockIndex,
        );

        await this.blockchain.initiateLitigation(
            offerId, dhIdentity, dcIdentity, objectIndex, blockIndex,
            merkleProof, blockchain_id,
        ).response;
        return {
            commands: [{
                name: 'dcLitigationInitiatedCommand',
                data: {
                    objectIndex,
                    blockIndex,
                    offerId,
                    blockchain_id,
                    dhIdentity,
                },
                period: 5000,
                retries: 3,
                deadline_at: Date.now() + (5 * 60 * 1000),
                transactional: false,
            }],
        };
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            offerId,
            dhIdentity,
            objectIndex,
            blockIndex,
        } = command.data;

        this.logger.error(`Initiating litigation for holder ${dhIdentity} and offer ${offerId} FAILED!`);

        this.errorNotificationService.notifyError(
            err,
            {
                objectIndex,
                blockIndex,
                dhIdentity,
                offerId,
            },
            constants.PROCESS_NAME.litigationHandling,
        );

        return Command.empty;
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            name: 'dcLitigationInitiateCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCLitigationInitiateCommand;
