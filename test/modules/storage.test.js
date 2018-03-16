const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const storage = require('../../modules/storage')();
const utilities = require('../../modules/utilities')();

describe('Storage tests', () => {
    it('check that user can retrieve stored data from local mongodb', () => {
        const keyToStore = 'capitalOfGermany';
        const valueToStore = 'Berlin';

        storage.storeObject(keyToStore, valueToStore, (response) => {
            expect(response).to.be.true;
        });
        storage.getObject(keyToStore, (responseData) => {
            expect(responseData).to.be.equal(valueToStore);
        });
    });
});
