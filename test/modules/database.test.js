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

let systemDb;
let otnode;
let db;

describe.only('Database module ', async () => {
    before('create and use otnode db', async () => {
        systemDb = new Database();
        otnode = await systemDb.createDatabase(
            DB_DATABASE,
            [{ username: DB_USERNAME, passwd: DB_PASSWORD, active: true }],
        );
        // this should start using otnode
        db = database.getConnection();
    });

    after('drop otnode db', async () => {
        systemDb = new Database();
        await systemDb.dropDatabase(DB_DATABASE);
    });

    it('some basics', async () => {
        expect(systemDb.name).to.be.equal('_system');
        const listOfDatabases = await systemDb.listDatabases();
        assert.equal(listOfDatabases[0], '_system');
        assert.equal(listOfDatabases[1], 'otnode');
    });

    it('run a simple query', async () => {
        const now = Date.now();
        await database.runQuery('RETURN @value', (result) => {
            console.log(result);
        }, { value: now });
    });
});
