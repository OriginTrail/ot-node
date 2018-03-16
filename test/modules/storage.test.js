const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const storage = require('../../modules/storage')();
const utilities = require('../../modules/utilities')();

const keyToStore = utilities.getRandomString(utilities.getRandomInt(10));
const valueToStore = utilities.getRandomString(utilities.getRandomInt(10));

describe('Storage tests', () => {
    before('store data', async () => {
        await storage.storeObject(keyToStore, valueToStore, (response) => {
            expect(response).to.be.true;
        });
    });

    it('check that user can retrieve stored data from local mongodb', async () => {
        await storage.getObject(keyToStore, (responseData) => {
            expect(responseData).to.be.equal(valueToStore);
        });
    });
});
