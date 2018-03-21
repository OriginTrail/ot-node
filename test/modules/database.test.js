const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const database = require('../../modules/database')();

const DB_USERNAME = 'otuser';
const DB_PASSWORD = 'otpass';
const DB_HOST = 'localhost';
const DB_PORT = 8529;
const DB_DATABASE = 'otnode';

let myDb;

describe.only('Database module ', async () => {
    it('getConnection method should return a db back', async () => {
        myDb = database.getConnection();
        expect(myDb.name).to.be.equal(DB_DATABASE);
        const listOfDatabases = await myDb.listDatabases();
        assert.equal(listOfDatabases[0], '_system');
        assert.equal(listOfDatabases[1], 'otnode');
    });
});
