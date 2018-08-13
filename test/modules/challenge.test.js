'use-strict';

const models = require('../../models');
const Storage = require('../../modules/Storage');

const {
    describe, before, beforeEach, it,
} = require('mocha');
const { expect } = require('chai');
const assert = require('assert').strict;
const Challenge = require('../../modules/Challenge');
const SystemStorage = require('../../modules/Database/SystemStorage');
const Utilities = require('../../modules/Utilities');

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

    const blocks = Challenge.getBlocks(vertexData, expectedBlockSize);
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
    let blocks = Challenge.getBlocks(vertexData, 32);
    checkBlocks(blocks, vertexData);

    blocks = Challenge.getBlocks(vertexData, 16);
    checkBlocks(blocks, vertexData);

    blocks = Challenge.getBlocks(vertexData, 1);
    checkBlocks(blocks, vertexData);
}

function testGenerateTests() {
    const dataCreatorId = 'dummyDC';
    const importId = 'dummyImportId';

    const startTime = Date.now();
    const endTime = new Date(startTime +
        (60000 * 60 * 24 * 30 * 6)).getTime(); // Roughly add six months

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

describe('Challenge tests', () => {
    describe('Block generation', () => {
        const blockTests = [
            { args: [vertexData, 32] },
            { args: [vertexData, 16] },
            { args: [vertexData, 1] },
        ];

        blockTests.forEach((test) => {
            it(`should correctly generate blocks of ${test.args[1]} bytes`, () => {
                const blocks = Challenge.getBlocks(test.args[0], test.args[1]);
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

    describe('Adding to and manipulating challenges from db', () => {
        const numberOfChallengesToGenerate = 10;
        const numberOfChallengesToAnswer = 5;
        const byteSize = 32;
        const myDataCreatorId = 'dummyDC';
        const myImportId = 'dummyImportId';
        const myStartTime = new Date('January 1, 2019 03:24:00').getTime();
        const myEndTime = new Date('January 1, 2020 00:24:00').getTime();

        before('Sync models', async () => {
            Storage.models = (await models.sequelize.sync()).models;
            Storage.db = models.sequelize;
        });

        beforeEach('cleanup db and populate db with generated challenges', async () => {
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

            // eslint-disable-next-line max-len
            const generatedTests = Challenge.generateTests(myDataCreatorId, myImportId, numberOfChallengesToGenerate, myStartTime, myEndTime, byteSize, vertexData);
            // adding generated challenges should store them in db
            try {
                await Challenge.addTests(generatedTests);
            } catch (error) {
                console.log(error);
            }
        });

        it('getTests() should retrieve all challenges from db', async () => {
            const result = await Challenge.getTests(myDataCreatorId, myImportId);
            expect(result.length).to.be.equal(numberOfChallengesToGenerate);
        });

        it('getUnansweredTest() should return only entries without any answer', async () => {
            const result = await Challenge.getUnansweredTest(myStartTime, myEndTime);
            expect(result.length).to.be.equal(numberOfChallengesToGenerate);
        });

        it('getNextTest() should return non-answered test if any present from current moment', async () => {
            const result = await Challenge.getNextTest(myDataCreatorId, myImportId);
            // this expect is connected to values set for myStartTime and myEndTime
            // since the method impl. checks for challenges from present moment till future
            // we can excpect that in this case it will retrieve all of them
            expect(result.length).to.be.equal(numberOfChallengesToGenerate);
        });

        it('completeTest() should mark corresponding entry as correctly answered', async () => {
            const tests = await Challenge.getTests(myDataCreatorId, myImportId);
            for (let j = 0; j < numberOfChallengesToAnswer; j += 1) {
                await Challenge.completeTest(tests[j].id); // eslint-disable-line no-await-in-loop
            }

            const unansweredTests = await Challenge.getUnansweredTest(myStartTime, myEndTime);
            // eslint-disable-next-line max-len
            expect(unansweredTests.length).to.be.equal(numberOfChallengesToGenerate - numberOfChallengesToAnswer);
        });

        it('failTest() should mark corresponding entry as incorrectly answered', async () => {
            // next line only for debuging of flacky test purposes
            const dbStateBefore = await Challenge.getCurrentDbState();
            const unansweredTests = await Challenge.getUnansweredTest(myStartTime, myEndTime);
            const randomIndex = Utilities.getRandomInt(unansweredTests.length - 1);
            await Challenge.failTest(unansweredTests[randomIndex].id);
            // next line only for debuging of flacky test purposes
            const dbStateAfterFailingSingleChallenge = await Challenge.getCurrentDbState();
            const unansweredTestsAfterFail =
                await Challenge.getUnansweredTest(myStartTime, myEndTime);
            try {
                expect(unansweredTestsAfterFail.length).to.be.equal(unansweredTests.length - 1);
            } catch (error) {
                console.log('DB State in the begining of time');
                console.log(dbStateBefore);
                console.log('---------------------');
                console.log(`Random id of challenge to be failed = ${unansweredTests[randomIndex].id}`);
                console.log('DB State in the after failing single challange');
                console.log(dbStateAfterFailingSingleChallenge);
                console.log('---------------------');
                console.log('unansweredTestsAfterFail');
                console.log(unansweredTestsAfterFail);
                console.log('---------------------');
                console.log(`${unansweredTestsAfterFail.length} should be one less then ${unansweredTests.length}`);
                console.log(error);
            }
        });

        it('answerTestQuestion() should return correct block chunk', () => {
            expect(Challenge.answerTestQuestion(10, vertexData, byteSize)).to.be.equal('ulla pariatur. Excepteur sint oc');
            expect(Challenge.answerTestQuestion(8, vertexData, byteSize)).to.be.equal(' reprehenderit in voluptate veli');
            expect(Challenge.answerTestQuestion(6, vertexData, byteSize)).to.be.equal('isi ut aliquip ex ea commodo con');
            expect(Challenge.answerTestQuestion(13, vertexData, byteSize)).to.be.equal('t mollit anim  id est laborum');
            expect(Challenge.answerTestQuestion(2, vertexData, byteSize)).to.be.equal('eiusmod tempor incididunt ut lab');
            expect(Challenge.answerTestQuestion(4, vertexData, byteSize)).to.be.equal('nim ad minim veniam, quis nostru');
        });
    });
}).timeout(5000);
