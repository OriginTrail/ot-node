const utilities = require('../Utilities');
const models = require('../../models/index');
const importUtilities = require('../ImportUtilities');

const DEFAULT_NUMBER_OF_TESTS = 10;
const DEFAULT_BLOCK_SIZE_IN_BYTES = 32;

class ChallengeService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.notifyError = ctx.notifyError;
    }

    /**
     * Send challenges for specified offer
     * @return {Promise<void>}
     */
    async sendOfferChallenges(offerId) {
        const litigationCandidates = await this._getLitigationCandidates(offerId);
        if (litigationCandidates.length === 0) {
            return;
        }

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        const vertices = await this.graphStorage.findVerticesByImportId(offer.data_set_id, false);

        litigationCandidates.forEach(async (candidate) => {
            const numberOfTests = DEFAULT_NUMBER_OF_TESTS;

            const encryptedVertices = importUtilities
                .immutableEncryptVertices(vertices, candidate.litigation_private_key);
            const tests = this
                .generateTests(numberOfTests, DEFAULT_BLOCK_SIZE_IN_BYTES, encryptedVertices);
            const challenge = tests[utilities.getRandomInt(numberOfTests)];

            this.logger.trace(`Sending challenge to ${candidate.dh_id}. Import ID ${candidate.data_set_id}, block ID ${challenge.block_id}.`);

            const response = await this.transport.challengeRequest({
                payload: {
                    dataset_id: candidate.data_set_id,
                    block_id: challenge.block_id,
                },
            }, candidate.dh_id);

            const status = this.transport.extractResponseStatus(response);
            if (typeof status === 'undefined') {
                this.logger.warn('challenge-request: Missing status');
                return;
            }

            if (status !== 'success') {
                this.logger.trace('challenge-request: Response not successful.');
                return;
            }

            if (response.answer === challenge.answer) {
                this.logger.trace('Successfully answered to challenge.');
            } else {
                this.logger.info(`Wrong answer to challenge '${response.answer} for DH ID ${challenge.dh_id}.'`);
            }
        });
    }

    /**
     * Get holders that can be litigated
     * @param offerId - Offer ID
     * @return {Promise<Array<Model>>}
     * @private
     */
    async _getLitigationCandidates(offerId) {
        return models.replicated_data.findAll({
            where: {
                offer_id: offerId,
                status: 'HOLDING',
            },
        });
    }

    /**
     * Generate test challenges for Data Holder
     * @param numberOfTests Number of challenges to generate.
     * @param blockSizeBytes Desired block size.
     * @param vertexData Input vertex data.
     * @returns {Array}
     */
    generateTests(numberOfTests, blockSizeBytes, vertexData) {
        if (numberOfTests <= 0) {
            throw new Error('Number of tests cannot be nonpositive');
        }

        if (blockSizeBytes < 1) {
            throw new Error('Block size must be greater than 0.');
        }

        const tests = [];
        const blocks = this.getBlocks(vertexData, blockSizeBytes);
        let testBlockId = 0;
        for (let i = 0; i < numberOfTests; i += 1) {
            testBlockId = Math.floor(Math.random() * blocks.length);
            tests.push({
                block_id: testBlockId,
                answer: blocks[testBlockId],
            });
        }
        return tests;
    }

    /**
     * Creates array of blocks based on the vertex data.
     * @note Last block can be smaller than desired blockSizeBytes.
     * @param vertexData Vertex data in form { ..., data: "vertex-data" }
     * @param blockSizeBytes Desired size of each block.
     * @returns {Array} of blocks.
     */
    getBlocks(vertexData, blockSizeBytes) {
        const blocks = [];
        let block = String();
        let byteIndex = 0;
        let bytesToCopy = 0;

        for (let i = 0; i < vertexData.length; i += 1) {
            const { data } = vertexData[i];
            if (data != null) {
                for (let j = 0; j < data.length;) {
                    bytesToCopy = Math.min(blockSizeBytes, blockSizeBytes - byteIndex);

                    const substring = data.substring(j, j + bytesToCopy);
                    block += substring;
                    byteIndex += substring.length; // May be less than wanted bytesToCopy.
                    j += substring.length;

                    if (byteIndex === blockSizeBytes) {
                        blocks.push(block);
                        block = String();
                        byteIndex = 0;
                    }
                }
            }
        }

        if (block.length > 0) {
            // Add last node.
            blocks.push(block);
        }
        return blocks;
    }
}

module.exports = ChallengeService;
