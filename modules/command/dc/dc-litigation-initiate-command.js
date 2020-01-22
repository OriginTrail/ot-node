const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const MerkleTree = require('../../Merkle');
const importUtilities = require('../../ImportUtilities');
const importService = require('../../service/import-service');

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
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            offerId,
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

        const dcIdentity = utilities.normalizeHex(this.config.erc725Identity);
        const otJson = await this.importService.getImport(offer.data_set_id);

        const encryptedGraph = importUtilities.encryptDataset(
            otJson,
            litigationPrivateKey,
        );

        importUtilities.sortGraphRecursively(encryptedGraph['@graph']);

        const merkleProof = this.challengeService.createChallengeProof(
            encryptedGraph['@graph'],
            objectIndex,
            blockIndex,
        );

        await this.blockchain.initiateLitigation(
            offerId, dhIdentity, dcIdentity, objectIndex, blockIndex,
            merkleProof,
        );
        return {
            commands: [{
                name: 'dcLitigationInitiatedCommand',
                data: {
                    objectIndex,
                    blockIndex,
                    offerId,
                    dhIdentity,
                },
                period: 5000,
                deadline_at: Date.now() + (5 * 60 * 1000),
                transactional: false,
            }],
        };
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
