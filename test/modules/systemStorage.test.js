const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');
const SystemStorage = require('../../modules/Database/SystemStorage');
const fs = require('fs');
const path = require('path');

let myConnection;

describe('SystemStorage module', () => {
    it('connect() to existing system.db', async () => {
        myConnection = await SystemStorage.connect();
        assert.isTrue(myConnection.filename.toString().indexOf('system.db') >= 0);
    });

    it('runSystemQuery() ', async () => {
        const result = await SystemStorage.runSystemQuery('SELECT Date(?) as Date', ['now']);
        assert.equal(result[0].Date, new Date().toISOString().slice(0, 10));
    });

    it('runSystemUpdate() ', async () => {
        // TODO better update query needed
        const result = await SystemStorage.runSystemUpdate('SELECT Date(?) as Date', ['now']);
        // eslint-disable-next-line no-unused-expressions
        expect(result).to.be.undefined;
    });

    it('calls to non existing db', async () => {
        // temp set db to point to null
        SystemStorage.db = null;

        try {
            const result = await SystemStorage.runSystemQuery('SELECT Date(?) as Date', ['now']);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Not connected to database') >= 0);
        }
        try {
            // TODO better update query needed
            const result = await SystemStorage.runSystemUpdate('SELECT Date(?) as Date', ['now']);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Not connected to database') >= 0);
        }

        // return db to point to system.db
        SystemStorage.db = myConnection;
    });
});
