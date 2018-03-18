const { describe, it } = require('mocha');
const { assert, expect } = require('chai');
const storage = require('../../modules/storage')();
const utilities = require('../../modules/utilities')();

const keyToStore = utilities.getRandomString(utilities.getRandomInt(10));
const valueToStore = utilities.getRandomString(utilities.getRandomInt(10));
const valueToStore2 = utilities.getRandomString(utilities.getRandomInt(10));

describe('Storage tests', () => {
    it('store new data under random key with random value', (done) => {
        storage.storeObject(keyToStore, valueToStore, (response) => {
            expect(response).to.be.true;
            done();
        });
    });

    it('check that user can retrieve stored data from local mongodb', (done) => {
        storage.getObject(keyToStore, (responseData) => {
            console.log(`expecting ${responseData} to be equal to ${valueToStore}`);
            expect(responseData).to.be.equal(valueToStore);
            done();
        });
    });

    it('update existing key with a new value', (done) => {
        storage.storeObject(keyToStore, valueToStore2, (response) => {
            expect(response).to.be.true;
            done();
        });
    });

    it('check that user can retrieve stored data from local mongodb', (done) => {
        storage.getObject(keyToStore, (responseData) => {
            console.log(`expecting ${responseData} to be equal to ${valueToStore2}`);
            expect(responseData).to.be.equal(valueToStore2);
            done();
        });
    });
});
