const SystemStorage = require('./Database/systemStorage');
const deasync = require('deasync-promise');

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
        console.log('generateTests:');
        console.log(`Data creator: ${dataCreator}`);
        console.log(`Import ID: ${importId}`);
        console.log(`Number of tests: ${numberOfTests}`);
        console.log(`Start time: ${new Date(startTime).toString()}`);
        console.log(`End time: ${new Date(endTime).toString()}`);
        console.log(`Block size: ${blockSizeBytes}`);
        console.log(`Vertex data: ${vertexData}`);

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
            console.log(new Date(randomIntervals[i]).toString());
        }

        const blocks = this.__getBlocks__(vertexData, blockSizeBytes);

        for (let i = 0; i < blocks.length; i += 1) {
            console.log(`Block ${i}, size ${blocks[i].length} ${blocks[i]}`);
        }

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
     * @param testID Test ID.
     * @returns {Promise<any>}
     */
    static completeTest(testId) {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery(
                    'UPDATE data_challenges SET answered=? WHERE id=?',
                    [Date.now(), testId],
                ).then((rows) => {
                    resolve(rows);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Stores tests into storage database.
     * @see SystemStorage
     * @param tests Tests to store.
     * @returns {Promise<any>}
     */
    static addTests(tests) {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                // Delete any old tests
                deasync(db.runSystemQuery(
                    'DELETE FROM data_challenges WHERE dh_id=? AND import_id=?',
                    [tests[0].dhId, tests[0].importId],
                ));
                for (let i = 0; i < tests.length; i += 1) {
                    // This should be done synchronously.
                    deasync(db.runSystemQuery(
                        'INSERT INTO data_challenges (time, block_id, answer, dh_id, import_id) VALUES (?, ?, ?, ?, ?)',
                        [tests[i].time, tests[i].block, tests[i].answer, tests[i].dhId,
                            tests[i].importId],
                    ));
                }
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Returns all the challenges for given Data Handler and Import ID.
     * @param dhtId Data Handler ID.
     * @param importId Import ID.
     * @returns {Promise<any>}
     */
    static getTests(dhtId, importId) {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery(
                    'SELECT id, time, block_id, answer FROM data_challenges WHERE dh_id=? AND import_id=?',
                    [dhtId, importId],
                ).then((rows) => {
                    resolve(rows);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Returns next non-answered test if any present from now on.
     * @param dhId ID of Data Handler client.
     * @param importId ID of the import.
     * @returns {Promise<any>}
     */
    static getNextTest(dhId, importId) {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery(
                    // todo add import id
                    'SELECT id, time, block_id, answer FROM data_challenges WHERE dh_id=? AND import_id=? AND time > ? AND answered NOT NULL',
                    [dhId, importId, Date.now()],
                ).then((rows) => {
                    resolve(rows);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
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
        const blocks = this.__getBlocks__(vertexData, blockSize);
        return blocks[blockId];
    }

    /**
     * Creates array of blocks based on the vertex data.
     * @note Last block can be smaller than desired blockSizeBytes.
     * @param vertexData Vertex data in form { ..., data: "vertex-data" }
     * @param blockSizeBytes Desired size of each block.
     * @returns {Array} of blocks.
     * @private
     */
    static __getBlocks__(vertexData, blockSizeBytes) {
        const blocks = [];
        let block = String();
        let byteIndex = 0;
        let bytesToCopy = 0;

        for (let i = 0; i < vertexData.length; i += 1) {
            const { data } = vertexData[i];
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

        if (block.length > 0) {
            // Add last node.
            blocks.push(block);
        }

        return blocks;
    }
}

module.exports = Challenge;
