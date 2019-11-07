const constants = require('../constants');
const importUtilities = require('../ImportUtilities');
const Merkle = require('../Merkle');
const utilities = require('../Utilities');


class ChallengeService {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    /**
     * Generate test challenges for Data Holder
     * @param encryptedGraphData Input vertex data.
     * @param startTime Unix timestamp in milliseconds of the start time of the testing period.
     * @param endTime Unix timestamp in milliseconds of the end of the testing period.
     * @param numberOfTests Number of challenges to generate.
     * @param blockSizeBytes Desired block size.
     * @returns {Array}
     */
    generateChallenges(
        encryptedGraphData, startTime, endTime,
        numberOfTests = constants.DEFAULT_CHALLENGE_NUMBER_OF_TESTS,
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
        const blocks = this.getBlocks(encryptedGraphData, blockSizeBytes);
        let testBlockId = 0;
        for (let i = 0; i < numberOfTests; i += 1) {
            testBlockId = Math.floor(Math.random() * blocks.length);
            const answer = blocks[testBlockId].data;

            tests.push({
                testIndex: testBlockId,
                objectIndex: blocks[testBlockId].objectIndex,
                blockIndex: blocks[testBlockId].blockIndex,
                answer,
                time: randomIntervals[i],
            });
        }
        return tests;
    }

    /**
     * Returns answer block for given object ID, block ID and block size and vertex data.
     * @param blockIndex ID of the required block.
     * @param encryptedObject Graph object with properties encrypted.
     * @param blockSizeInBytes Desired size of each block.
     * @returns {String}
     */
    answerChallengeQuestion(
        blockIndex, encryptedObject,
        blockSizeInBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
    ) {
        encryptedObject = utilities.sortedStringify(encryptedObject, true);

        let answer = JSON.stringify(encryptedObject).substring(
            blockIndex * blockSizeInBytes,
            (blockIndex + 1) * blockSizeInBytes,
        );
        answer = answer.padEnd(blockSizeInBytes, '#');
        return answer;
    }

    /**
     * Creates array of blocks based on the vertex data.
     * @note Last block can be smaller than desired blockSizeBytes.
     * @param vertices Vertex data in form { ..., data: "vertex-data" }
     * @param blockSizeInBytes Desired size of each block.
     * @returns {Array} of blocks.
     */
    getBlocks(vertices, blockSizeInBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES) {
        importUtilities.sort(vertices);

        const blocks = [];
        let block = String();

        for (let i = 0; i < vertices.length; i += 1) {
            const data = JSON.stringify(utilities.sortedStringify(vertices[i], true));

            if (data) {
                for (let j = 0; j < data.length; j += blockSizeInBytes) {
                    block = String();

                    const substring = data.substring(j, j + blockSizeInBytes);
                    block += substring;
                    block = block.padEnd(blockSizeInBytes, '#');
                    blocks.push({
                        data: block,
                        objectIndex: i,
                        blockIndex: j / blockSizeInBytes,
                    });
                }
            }
        }
        return blocks;
    }

    getLitigationRootHash(
        encryptedGraphData,
        blockSizeInBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
    ) {
        const blocks = this.getBlocks(encryptedGraphData, blockSizeInBytes);

        const litigationMerkleTree = new Merkle(blocks, 'litigation');

        return litigationMerkleTree.getRoot();
    }
}

module.exports = ChallengeService;
