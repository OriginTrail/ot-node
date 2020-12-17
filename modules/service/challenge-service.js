const constants = require('../constants');
const importUtilities = require('../ImportUtilities');
const Merkle = require('../Merkle');
const utilities = require('../Utilities');

class ChallengeService {
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
        const sortedObject = utilities.sortedStringify(encryptedObject, true);
        const answer = this.getBlockFromObject(sortedObject, blockIndex, blockSizeInBytes);
        return answer;
    }

    /**
     * Creates array of blocks based on the vertex data.
     * @note Last block can be smaller than desired blockSizeBytes.
     * @param graphObjects OT-JSON objects in form { ..., data: "vertex-data" }
     * @param blockSizeInBytes Desired size of each block.
     * @returns {Array} of blocks.
     */
    getBlocks(graphObjects, blockSizeInBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES) {
        const blocks = [];

        for (let objectIndex = 0; objectIndex < graphObjects.length; objectIndex += 1) {
            const numberOfBlocksInObject =
                Math.ceil(Buffer.byteLength(JSON.stringify(graphObjects[objectIndex]), 'utf-8') / blockSizeInBytes);
            const sortedObject = utilities.sortedStringify(graphObjects[objectIndex], true);
            for (let blockIndex = 0; blockIndex < numberOfBlocksInObject; blockIndex += 1) {
                const block = this.getBlockFromObject(
                    sortedObject,
                    blockIndex,
                    blockSizeInBytes,
                );

                blocks.push({
                    data: block,
                    objectIndex,
                    blockIndex,
                });
            }
        }
        return blocks;
    }

    getBlockFromObject(
        object,
        index,
        blockSizeInBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
    ) {
        const rawObject = Buffer.from(object, 'utf-8');

        const rawBlock = Buffer.alloc(blockSizeInBytes);

        const rawSubstring = rawObject.slice(
            index * blockSizeInBytes,
            (index + 1) * blockSizeInBytes,
        );

        rawBlock.write(rawSubstring.toString('utf-8'));

        if (rawSubstring.length < blockSizeInBytes) {
            const padding = '0'.repeat(blockSizeInBytes - rawSubstring.length);
            rawBlock.write(padding, rawSubstring.length);
        }

        const block = rawBlock.toString('utf-8');

        return block;
    }

    getLitigationRootHash(
        encryptedGraphData,
        blockSizeInBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
    ) {
        const blocks = this.getBlocks(encryptedGraphData, blockSizeInBytes);
        const litigationMerkleTree = new Merkle(blocks, 'litigation');
        return litigationMerkleTree.getRoot();
    }

    createChallengeProof(
        encryptedGraphData,
        objectIndex,
        blockIndex,
        blockSizeInBytes = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
    ) {
        const blocks = this.getBlocks(encryptedGraphData, blockSizeInBytes);

        const litigationMerkleTree = new Merkle(blocks, 'litigation');

        return litigationMerkleTree.createProof(objectIndex, blockIndex);
    }
}

module.exports = ChallengeService;
