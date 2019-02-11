const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const MerkleTree = require('../../Merkle');
const importUtilities = require('../../ImportUtilities');

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
        this.challengeService = ctx.challengeService;
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
            blockId,
            litigationPrivateKey,
        } = command.data;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        if (offer.global_status !== 'ACTIVE') {
            this.logger.trace(`Litigation already in progress... It needs to be completed in order to litigate ${dhIdentity} for offer ${offerId}`);
            return Command.repeat(); // wait for offer to be active
        }

        if (offer.global_status === 'COMPLETED') {
            // offer has already been completed
            this.logger.warn(`Offer ${offerId} has already been completed. Skipping litigation for DH identity ${dhIdentity} and block ${blockId}`);
            return Command.empty();
        }

        offer.global_status = 'LITIGATION_INITIATED';
        await offer.save(({ fields: ['global_status'] }));

        const dcIdentity = utilities.normalizeHex(this.config.erc725Identity);
        const vertices = await this.graphStorage.findVerticesByImportId(offer.data_set_id);

        const encryptedVertices = importUtilities.immutableEncryptVertices(
            vertices,
            litigationPrivateKey,
        );

        importUtilities.sort(encryptedVertices);
        const litigationBlocks = this.challengeService.getBlocks(encryptedVertices);
        const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
        const merkleProof = litigationBlocksMerkleTree.createProof(blockId);

        await this.blockchain.initiateLitigation(
            offerId, dhIdentity, dcIdentity, blockId,
            merkleProof,
        );
        return {
            commands: [{
                name: 'dcLitigationInitiatedCommand',
                data: {
                    blockId,
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
