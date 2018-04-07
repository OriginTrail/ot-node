const assert = require('assert').strict;
const Challenge = require('../../modules/Challenge');

// TODO: Rewrite this for Mocha tests.


// Global declarations.
var vertexData = [
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

    if (dataSummed !== blockSummed) { throw new Error('Blocks and data are not the same.'); }
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
        assert.deepEqual(test.dhId, expectedDhId);
        assert.deepEqual(test.importId, expectedImportId);
        assert(test.time > startTime, `Test time: ${new Date(test.time)}, start time: ${new Date(startTime)}`);
        assert(test.time <= endTime, `Test time: ${new Date(test.time)}, end time: ${new Date(endTime)}`);
        assert(test.time > previousTestTime);
        assert.deepEqual(test.answer, blocks[test.block]);

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
    testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, -1, startTime, endTime, 32, vertexData);
    };
    assert.throws(testFunc, 'Negative tests asked. Should crash!');

    // Nonpositive block size.
    testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, 10, startTime, endTime, 0, vertexData);
    };
    assert.throws(testFunc, 'Zero block size asked. Should crash!');
    testFunc = function testFunc() {
        Challenge.generateTests(dataCreatorId, importId, 10, startTime, endTime, -1, vertexData);
    };
    assert.throws(testFunc, 'Negatice block size asked. Should crash!');
}


testBlocks();
testGenerateTests();