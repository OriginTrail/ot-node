const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');
const SystemStorage = require('../../modules/Database/SystemStorage');
const fs = require('fs');
const path = require('path');

describe('SystemStorage module', () => {
    it('connect() to existing system.db', async () => {
        const myConnection = await SystemStorage.connect();
        assert.isTrue(myConnection.filename.toString().indexOf('system.db') >= 0);
    });

    it(' runSystemQuery ', async () => {
        const result = await SystemStorage.runSystemQuery('SELECT Date(?) as Date', ['now']);
        assert.equal(result[0].Date, new Date().toISOString().slice(0, 10));
    });

    it(' runSystemUpdate ', async () => {
        const result = await SystemStorage.runSystemUpdate('SELECT Date(?) as Date', ['now']);
        // eslint-disable-next-line no-unused-expressions
        expect(result).to.be.undefined;
    });
});
