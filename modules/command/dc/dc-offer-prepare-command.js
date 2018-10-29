const Command = require('../command');

/**
 * Prepare offer parameters (litigation/distribution hashes, etc.)
 */
class DCOfferPrepareCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
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
            internalOfferId,
        } = command.data;

        const colorsInfo = await this.replicationService.createReplications(internalOfferId);
        const distLitRootHashes = (await Promise.all(colorsInfo.map(async (cInfo) => {
            await this.replicationService.saveReplication(internalOfferId, cInfo.color, cInfo);

            const hashes = {};
            hashes[`${cInfo.color}LitigationHash`] = cInfo.litigationRootHash;
            hashes[`${cInfo.color}DistributionHash`] = cInfo.distributionRootHash;
            return hashes;
        }))).reduce((acc, value) => Object.assign(acc, value));

        const { data } = command;
        Object.assign(data, distLitRootHashes);
        return this.continueSequence(data, command.sequence);
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
