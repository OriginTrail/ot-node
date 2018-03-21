const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');
const utilities = require('../../modules/utilities')();
const database = require('../../modules/database')();
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;

const DB_USERNAME = 'otuser';
const DB_PASSWORD = 'otpass';
const DB_HOST = 'localhost';
const DB_PORT = 8529;
const DB_DATABASE = 'otnode';

let db;
let otnode;

describe('Database module ', async () => {
    before('create otnode db', async () => {
        db = new Database();
        otnode = await db.createDatabase(DB_DATABASE, [{username: DB_USERNAME, password: DB_PASSWORD}]);
        await db.useDatabase(DB_DATABASE);
    });

    after('drop otnode db', async () => {
        db = new Database();
        await db.dropDatabase(DB_DATABASE);
    });

    it('some basics', async () => {
        expect(db.name).to.be.equal(DB_DATABASE);
        const listOfDatabases = await db.listDatabases();
        assert.equal(listOfDatabases[0], '_system');
        assert.equal(listOfDatabases[1], 'otnode');
    });

    it.skip('run a simple query', async () => {
        const now = Date.now();
        await database.runQuery("RETURN @value", (result) => {
            console.log(result);
        }, { value: now });
    });
});
