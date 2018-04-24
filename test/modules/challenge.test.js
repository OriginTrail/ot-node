'use-strict';

const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
var { expect } = require('chai');
const assert = require('assert').strict;
const Challenge = require('../../modules/Challenge');
const SystemStorage = require('../../modules/Database/SystemStorage');

// Global declarations.
const vertexData = [
    { vertexKey: 'vertex0', data: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt' },
    { vertexKey: 'vertex1', data: ' ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation' },
    { vertexKey: 'vertex2', data: ' ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis' },
    { vertexKey: 'vertex3', data: ' aute irure dolor in reprehenderit in voluptate velit esse cillum' },
    { vertexKey: 'vertex4', data: ' dolore eu fugiat' },
    { vertexKey: 'vertex5', data: ' nulla pariatur. Excepteur sint occaecat cupidatat non proident' },
    { vertexKey: 'vertex6', data: ', sunt in culpa qui officia deserunt ' },
    { vertexKey: 'vertex7', data: 'mollit' },
    { vertexKey: 'vertex8', data: ' anim ' },
    { vertexKey: 'vertex9', data: ' id est laborum' },
];

// Helper functions.

function checkBlocks(blocks, data) {
    // Merge data.
    let dataSummed = String();

    for (let i = 0; i < data.length; i += 1) {
        dataSummed += data[i].data;
    }

    // Merge block data.
    let blockSummed = String();
    for (let i = 0; i < blocks.length; i += 1) {
        blockSummed += blocks[i];
    }

    expect(dataSummed).to.equal(blockSummed);
}

function checkForTests(
    tests, startTime, endTime, expectedBlockSize,
    expectedDhId, expectedImportId, originalData,
) {
    /*
    Expected test object:
    {
        time: ...,
        block: ...,
        answer: ...,
        dhId: ...,
        importId: ...,
     }
     */

    const blocks = Challenge.__getBlocks__(vertexData, expectedBlockSize);
    let previousTestTime = startTime;

    tests.forEach((test) => {
        expect(test.dhId).to.equal(expectedDhId);
        expect(test.importId).to.equal(expectedImportId);
        expect(test.time).to.be.greaterThan(startTime, `Test time: ${new Date(test.time)}, start time: ${new Date(startTime)}`);
        expect(test.time).to.be.lessThan(endTime, `Test time: ${new Date(test.time)}, end time: ${new Date(endTime)}`);
        expect(test.time).to.be.greaterThan(previousTestTime);
        expect(test.answer).to.equal(blocks[test.block]);

        previousTestTime = test.time;
    });
}

// Test functions.

function testBlocks() {
    let blocks = Challenge.__getBlocks__(vertexData, 32);
    checkBlocks(blocks, vertexData);

    blocks = Challenge.__getBlocks__(vertexData, 16);
    checkBlocks(blocks, vertexData);

    blocks = Challenge.__getBlocks__(vertexData, 1);
    checkBlocks(blocks, vertexData);
}

function testGenerateTests() {
    const dataCreatorId = 'dummyDC';
    const importId = 'dummyImportId';

    const startTime = new Date('May 1, 2018 03:24:00').getTime();
    const endTime = new Date('January 1, 2019 00:24:00').getTime();

    // Since tests are generated randomly. Test test creation multiple times.
    for (let i = 0; i < 10; i += 1) {
        const tests = Challenge.generateTests(
            dataCreatorId, importId, 10,
            startTime, endTime, 32, vertexData,
        );
        checkForTests(tests, startTime, endTime, 32, dataCreatorId, importId, vertexData);
    }

    // Start time after end time.
    let testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, 10, endTime, startTime, 32, vertexData);
    };
    assert.throws(testFunc, 'Start time after end time. Should crash!');

    // Nonpositive number of tests.
    testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, 0, startTime, endTime, 32, vertexData);
    };
    assert.throws(testFunc, 'Zero tests asked. Should crash!');

    // Negative amount of challenges to generate.
    testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, -1, startTime, endTime, 32, vertexData);
    };
    assert.throws(testFunc, 'Negative tests asked. Should crash!');

    // Nonpositive block size.
    testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, 10, startTime, endTime, 0, vertexData);
    };
    assert.throws(testFunc, 'Zero block size asked. Should crash!');

    // Negative block size.
    testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, 10, startTime, endTime, -1, vertexData);
    };
    assert.throws(testFunc, 'Negative block size asked. Should crash!');
}

describe.only('Challenge tests', () => {
    describe('Block generation', () => {
        const blockTests = [
            { args: [vertexData, 32] },
            { args: [vertexData, 16] },
            { args: [vertexData, 1] },
        ];

        blockTests.forEach((test) => {
            it(`should correctly generate blocks of ${test.args[1]} bytes`, () => {
                const blocks = Challenge.__getBlocks__(test.args[0], test.args[1]);
                checkBlocks(blocks, test.args[0]);
            });
        });
    });

    describe('Test generation', () => {
        beforeEach('restore db', async () => {
            SystemStorage.connect().then(() => {
                SystemStorage.runSystemQuery('DELETE FROM data_challenges', []);
            });
        });

        const dataCreatorId = 'dummyDC';
        const importId = 'dummyImportId';

        const startTime = new Date('May 1, 2018 03:24:00').getTime();
        const endTime = new Date('January 1, 2019 00:24:00').getTime();


        const challengeTests = [
            { args: [dataCreatorId, importId, 10, startTime, endTime, 32, vertexData] },
            { args: [dataCreatorId, importId, 10, startTime, endTime, 16, vertexData] },
            { args: [dataCreatorId, importId, 10, startTime, endTime, 1, vertexData] },
        ];

        challengeTests.forEach((test) => {
            it(`should correctly generate ${test.args[2]} challenges of ${test.args[5]} bytes`, () => {
                const tests = Challenge.generateTests(...test.args);
                checkForTests(
                    tests, test.args[3], test.args[4],
                    test.args[5], test.args[0], test.args[1], test.args[6],
                );
            });
        });
    });

    describe('Adding tests', () => {
        const myDataCreatorId = 'dummyDC';
        const myImportId = 'dummyImportId';
        const myStartTime = new Date('May 1, 2018 03:24:00').getTime();
        const myEndTime = new Date('January 1, 2019 00:24:00').getTime();
        console.log(myStartTime, myEndTime);

        before('cleanup db', async () => {
            try {
                await SystemStorage.connect();
            } catch (error) {
                console.log('Smth went wrong with SystemStorage.connect()');
                console.log(error);
            }

            try {
                await SystemStorage.runSystemQuery('DELETE FROM data_challenges', []);
            } catch (error) {
                console.log('Smth went wrong with SystemStorage.runSystemQuery()');
                console.log(error);
            }
        });

        it('Adding challenges ', async () => {
            // eslint-disable-next-line max-len
            const generatedTests = Challenge.generateTests(myDataCreatorId, myImportId, 10, myStartTime, myEndTime, 32, vertexData);
            console.log('_______________________');
            console.log(generatedTests);
            console.log('_______________________');

            try {
                await Challenge.addTests(generatedTests);
                console.log('Test are added to db');
            } catch (error) {
                console.log(error);
            }
        });

        it('getTests()', async () => {
            try {
                const result = await Challenge.getTests(myDataCreatorId, myImportId);
                console.log('Retrieved tests:');
                console.log(result);
            } catch (error) {
                console.log(error);
            }
        });

        it('getUnansweredTest()', async () => {
            try {
                const result = await Challenge.getUnansweredTest(myStartTime, myEndTime);
                console.log('Retrieved unanswered tests:');
                console.log(result);
            } catch (error) {
                console.log(error);
            }
        });
    });
});
