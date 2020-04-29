/* eslint-disable */
require('dotenv').config();
const { describe, it } = require('mocha');
const { expect } = require('chai');
const ChallengeService = require('../../modules/service/challenge-service');

const logger = require('../../modules/logger');
const importUtilities = require('../../modules/ImportUtilities');
const utilities = require('../../modules/Utilities');

const challengeService = new ChallengeService({ logger });

// Global declarations.
let vertexData = [
    { '@id': 'vertex0', data: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt' },
    { '@id': 'vertex1', data: ' ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation' },
    { '@id': 'vertex2', data: ' ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis' },
    { '@id': 'vertex3', data: ' aute irure dolor in reprehenderit in voluptate velit esse cillum' },
    { '@id': 'vertex4', data: ' dolore eu fugiat' },
    { '@id': 'vertex5', data: ' nulla pariatur. Excepteur sint occaecat cupidatat non proident' },
    { '@id': 'vertex6', data: ', sunt in culpa qui officia deserunt ' },
    { '@id': 'vertex7', data: 'mollit' },
    { '@id': 'vertex8', data: ' anim ' },
    { '@id': 'vertex9', data: ' id est laborum' },
];

/**
 * Check if challenges are valid or not
 */
function checkChallenges(tests, startTime, endTime, expectedBlockSize) {
    const blocks = challengeService.getBlocks(vertexData, expectedBlockSize);
    let previousTestTime = startTime;

    expect(tests).to.not.be.null;
    tests.forEach((test) => {
        expect(test.time).to.be.greaterThan(startTime, `Test time: ${new Date(test.time)}, start time: ${new Date(startTime)}`);
        expect(test.time).to.be.lessThan(endTime, `Test time: ${new Date(test.time)}, end time: ${new Date(endTime)}`);
        expect(test.time).to.be.greaterThan(previousTestTime);
        expect(test.answer).to.equal(blocks.find(x => x.objectIndex === test.objectIndex && x.blockIndex === test.blockIndex).data);

        previousTestTime = test.time;
    });
}

describe('Challenge service tests', () => {
    vertexData = utilities.sortObjectRecursively(vertexData);

    describe('Challenge generation', () => {
        const startTime = new Date('May 1, 2018 03:24:00').getTime();
        const endTime = new Date('January 1, 2019 00:24:00').getTime();

        it('should throw error on invalid number of challenges', () => {
            expect(challengeService.generateChallenges.bind(challengeService, vertexData, startTime, endTime, -1)).to.throw('Number of challenges cannot be nonpositive');
        });

        it('should throw error on invalid block size', () => {
            expect(challengeService.generateChallenges.bind(challengeService, vertexData, startTime, endTime, 10, -1)).to.throw('Block size must be greater than 0');
        });

        it('should throw error on invalid start and end times', () => {
            expect(challengeService.generateChallenges.bind(challengeService, vertexData, endTime, startTime)).to.throw('Start time must be before end time');
        });

        const challengeTests = [
            { args: [vertexData, startTime, endTime, 10, 32] },
            { args: [vertexData, startTime, endTime, 10, 16] },
            { args: [vertexData, startTime, endTime, 10, 1] },
        ];

        challengeTests.forEach((test) => {
            it(`should correctly generate ${test.args[3]} challenges of ${test.args[4]} bytes`, () => {
                const tests = challengeService.generateChallenges(...test.args);
                checkChallenges(tests, test.args[1], test.args[2], test.args[4]);
            });
        });
    });

    describe('Challenge answers', () => {
        it('answerTestQuestion() should return correct block chunk', () => {
            expect(challengeService.answerChallengeQuestion(10, vertexData)).to.be.equal('at. Duis"},{"@id":"vertex3","da');
            expect(challengeService.answerChallengeQuestion(8, vertexData)).to.be.equal('"data":" ullamco laboris nisi u');
            expect(challengeService.answerChallengeQuestion(6, vertexData)).to.be.equal('ad minim veniam, quis nostrud e');
            expect(challengeService.answerChallengeQuestion(13, vertexData)).to.be.equal('e cillum"},{"@id":"vertex4","da');
            expect(challengeService.answerChallengeQuestion(2, vertexData)).to.be.equal('tur adipiscing elit, sed do eiu');
            expect(challengeService.answerChallengeQuestion(4, vertexData)).to.be.equal(':"vertex1","data":" ut labore e');
        });
    })
});
