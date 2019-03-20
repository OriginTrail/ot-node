const constants = require('../constants');
const importUtilities = require('../ImportUtilities');

class ChallengeService {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    /**
     * Generate test challenges for Data Holder
     * @param numberOfTests Number of challenges to generate.
     * @param blockSizeBytes Desired block size.
     * @param vertexData Input vertex data.
     * @param startTime Unix timestamp in milliseconds of the start time of the testing period.
     * @param endTime Unix timestamp in milliseconds of the end of the testing period.
     * @returns {Array}
     */
    generateChallenges(
        vertexData, startTime, endTime, numberOfTests = constants.DEFAULT_CHALLENGE_NUMBER_OF_TESTS,
        blockSizeBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
    ) {
        if (numberOfTests <= 0) {
            throw new Error('Number of challenges cannot be nonpositive');
        }

        if (blockSizeBytes < 1) {
            throw new Error('Block size must be greater than 0');
        }

        if (startTime >= endTime) {
            throw new Error('Start time must be before end time');
        }

        const randomIntervals = [];
        let randomSum = 0;

        // Create one more to avoid the last test's time to collide with end time.
        for (let i = 0; i <= numberOfTests; i += 1) {
            randomIntervals.push(Math.floor(Math.random() * (endTime - startTime)));
            randomSum += randomIntervals[i];
        }

        let previousInterval = startTime;
        for (let i = 0; i < numberOfTests; i += 1) {
            randomIntervals[i] = previousInterval +
                 Math.round((randomIntervals[i] * (endTime - startTime)) / randomSum);
            previousInterval = randomIntervals[i];
        }

        const tests = [];
        const blocks = this.getBlocks(vertexData, blockSizeBytes);
        let testBlockId = 0;
        for (let i = 0; i < numberOfTests; i += 1) {
            testBlockId = Math.floor(Math.random() * blocks.length);
            tests.push({
                block_id: testBlockId,
                answer: blocks[testBlockId],
                time: randomIntervals[i],
            });
        }
        return tests;
    }

    /**
     * Returns answer block for given block ID, block size and vertex data.
     * @param blockId ID of the required block.
     * @param vertexData Original vertex data.
     * @param blockSize Desired size of
     * @returns {String}
     */
    answerChallengeQuestion(
        blockId, vertexData,
        blockSize = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
    ) {
        const blocks = this.getBlocks(vertexData, blockSize);
        return blocks[blockId];
    }

    /**
     * Creates array of blocks based on the vertex data.
     * @note Last block can be smaller than desired blockSizeBytes.
     * @param vertices Vertex data in form { ..., data: "vertex-data" }
     * @param blockSizeBytes Desired size of each block.
     * @returns {Array} of blocks.
     */
    getBlocks(vertices, blockSizeBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES) {
        importUtilities.sort(vertices);

        const blocks = [];
        let block = String();
        let byteIndex = 0;
        let bytesToCopy = 0;

        for (let i = 0; i < vertices.length; i += 1) {
            const { data } = vertices[i];
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
