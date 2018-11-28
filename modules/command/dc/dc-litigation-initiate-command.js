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

        const dcIdentity = utilities.normalizeHex(this.config.erc725Identity);

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        const vertices = await this.graphStorage.findVerticesByImportId(offer.data_set_id, false);

        const encryptedVertices = importUtilities.immutableEncryptVertices(
            vertices,
            litigationPrivateKey,
        );

        importUtilities.sort(encryptedVertices);
        const litigationBlocks = this.challengeService.getBlocks(vertices);
        const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
        const merkleProof = litigationBlocksMerkleTree.createProof(blockId);

        await this.blockchain.initiateLitigation(
            offerId, dhIdentity, dcIdentity, blockId,
            merkleProof,
        );
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
