const SystemStorage = require('./Database/SystemStorage');
const Storage = require('./Storage');
const { Op } = require('sequelize');
const Models = require('../models');

const log = require('./Utilities').getLogger();

class Challenge {
    /**
     * Generate test challenges for Data Holder
     * @param dataCreator Data Creator ID.
     * @param importId ID of the import.
     * @param numberOfTests Number of challenges to generate.
     * @param startTime Unix timestamp in milliseconds of the start time of the testing period.
     * @param endTime Unix timestamp in milliseconds of the end of the testing period.
     * @param blockSizeBytes Desired block size.
     * @param vertexData Input vertex data.
     * @returns {Array}
     */
    static generateTests(
        dataCreator, importId, numberOfTests,
        startTime, endTime, blockSizeBytes, vertexData,
    ) {
        // log.info('generateTests');
        // console.log(`Data creator: ${dataCreator}`);
        // console.log(`Import ID: ${importId}`);
        // console.log(`Number of tests: ${numberOfTests}`);
        // console.log(`Start time: ${new Date(startTime).toString()}`);
        // console.log(`End time: ${new Date(endTime).toString()}`);
        // console.log(`Block size: ${blockSizeBytes}`);
        // console.log(`Vertex data: ${vertexData}`);

        if (numberOfTests <= 0) { throw new Error('Number of tests cannot be nonpositive'); }

        if (startTime >= endTime) { throw new Error('Start time must be before end time'); }

        if (blockSizeBytes < 1) { throw new Error('Block size must be greater than 0.'); }

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
            // console.log(new Date(randomIntervals[i]).toString());
        }

        const blocks = this.getBlocks(vertexData, blockSizeBytes);

        // for (let i = 0; i < blocks.length; i += 1) {
        //     console.log(`Block ${i}, size ${blocks[i].length} ${blocks[i]}`);
        // }

        const tests = [];
        let testBlockId = 0;
        for (let i = 0; i < numberOfTests; i += 1) {
            testBlockId = Math.floor(Math.random() * blocks.length);
            tests.push({
                time: randomIntervals[i],
                block: testBlockId,
                answer: blocks[testBlockId],
                dhId: dataCreator,
                importId,
            });
        }


        return tests;
    }

    /**
     * Returns promise that marks test with given ID as answered.
     * @param testId Test ID.
     * @returns {Promise<any>}
     */
    static async completeTest(testId) {
        await Models.data_challenges.update(
            { answered: Date.now() },
            { where: { id: testId } },
        );
    }

    /**
     * Returns promise that marks test as failed with given ID as answered.
     * @param testId Test ID.
     * @returns {Promise<any>}
     */
    static async failTest(testId) {
        await Models.data_challenges.update(
            { answered: -Date.now() },
            { where: { id: testId } },
        );
    }

    /**
     * Stores tests into storage database.
     * @see SystemStorage
     * @param tests Tests to store.
     * @returns {Promise<any>}
     */
    static async addTests(tests) {
        await Models.data_challenges.destroy({
            where: {
                dh_id: tests[0].dhId,
                import_id: tests[0].importId,
            },
        });

        return Promise.all([
            tests.forEach((test) => {
                Models.data_challenges.create({
                    time: test.time,
                    block_id: test.block,
                    answer: test.answer,
                    dh_id: test.dhId,
                    import_id: test.importId,
                    sent: false,
                });
            }),
        ]);
    }

    /**
     * Returns all the challenges for given Data Handler and Import ID.
     * @param dhtId Data Handler ID.
     * @param importId Import ID.
     * @returns {Promise<any>}
     */
    static async getTests(dhtId, importId) {
        return Models.data_challenges.findAll({
            attributes: ['id', 'time', 'block_id', 'answer'],
            where: {
                dh_id: dhtId,
                import_id: importId,
            },
        });
    }

    /**
    * Returns current state of database.
    * @returns {Promise}
    */
    static async getCurrentDbState() {
        Storage.db.query('SELECT * FROM data_challenges', {
            replacements: [],
        });
    }

    /**
     * Returns promise of all unanswered challenges between startTime and endTime.
     * @param startTime Unix time in milliseconds.
     * @param endTime Unix time in milliseconds.
     * @returns {Promise}
     */
    static async getUnansweredTest(startTime, endTime) {
        return Models.data_challenges.findAll({
            attributes: ['id', 'time', 'block_id', 'answer', 'dh_id', 'import_id', 'sent'],
            where: {
                time: {
                    [Op.between]: [startTime, endTime],
                },
                answered: null,
            },
        });
    }

    /**
     * Returns next non-answered test if any present from now on.
     * @param dhId ID of Data Handler client.
     * @param importId ID of the import.
     * @returns {Promise<any>}
     */
    static async getNextTest(dhId, importId) {
        return Models.data_challenges.findAll({
            attributes: ['id', 'time', 'block_id', 'answer'],
            where: {
                dh_id: dhId,
                import_id: importId,
                time: {
                    [Op.gt]: Date.now(),
                },
                answered: null,
            },
        });
    }

    /**
     * Returns answer block for given block ID, block size and vertex data.
     * @param blockId ID of the required block.
     * @param vertexData Original vertex data.
     * @param blockSize Desired size of
     * @returns {String}
     */
    static answerTestQuestion(blockId, vertexData, blockSize) {
        const blocks = this.getBlocks(vertexData, blockSize);
        return blocks[blockId];
    }

    /**
     * Creates array of blocks based on the vertex data.
     * @note Last block can be smaller than desired blockSizeBytes.
     * @param vertexData Vertex data in form { ..., data: "vertex-data" }
     * @param blockSizeBytes Desired size of each block.
     * @returns {Array} of blocks.
     */
    static getBlocks(vertexData, blockSizeBytes) {
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

module.exports = Challenge;
