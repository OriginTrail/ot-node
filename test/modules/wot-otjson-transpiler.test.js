/* eslint-disable max-len */
require('dotenv').config();
const {
    describe, before, it,
} = require('mocha');
const fs = require('fs');
const chai = require('chai');
const xml2js = require('xml-js');
const lodash = require('lodash');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const { assert, expect } = chai;
const path = require('path');
const rc = require('rc');
const Web3 = require('web3');

const { Database } = require('arangojs');
const Utilities = require('../../modules/Utilities');

const logger = require('../../modules/logger');
const GraphStorage = require('../../modules/Database/GraphStorage');

const ImportUtilities = require('../../modules/ImportUtilities');
const WotOtJsonImporter = require('../../modules/importer/ot-json-importer');
const WotOtJsonTranspiler = require('../../modules/transpiler/wot/wot-otjson-transpiler');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

const databaseName = 'ot-json-importer-test-db';

describe('WOT OT JSON transpiler tests', () => {
    let importer;
    let transpiler;

    let arango;
    let graphStorage;
    let selectedDatabase;

    const inputJsonFile = path.join(__dirname, '../../importers/json_examples/kakaxi.wot');

    before('Init WOT transpiler', async () => {
        const config = rc(pjson.name, defaultConfig);

        config.erc725Identity = '0x611d771aAfaa3D6Fb66c4a81D97768300a6882D5';
        config.node_wallet = '0xa9a07f3c53ec5de8dd83039ca27fae83408e16f5';
        config.node_private_key = '952e45854ca5470a6d0b6cb86346c0e9c4f8f3a5a459657df8c94265183b9253';

        selectedDatabase = config.database;
        selectedDatabase.database = databaseName;

        arango = new Database();
        arango.useBasicAuth(
            selectedDatabase.username,
            selectedDatabase.password,
        );

        // Drop test database if exist.
        const listOfDatabases = await arango.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await arango.dropDatabase(databaseName);
        }

        await arango.createDatabase(
            databaseName,
            [{
                username: selectedDatabase.username,
                passwd: selectedDatabase.password,
                active: true,
            }],
        );

        graphStorage = new GraphStorage(selectedDatabase, logger, {});
        await graphStorage.connect();

        const web3 = new Web3();
        transpiler = new WotOtJsonTranspiler({
            web3,
            config,
        });

        // importer = new EpcisOtJsonImporter({
        //     graphStorage,
        //     logger,
        //     config,
        //     notifyError: {},
        //     web3,
        // });
    });
    describe('Convert WOT JSON into OT-JSON and vice versa', () => {
        it(
            'should correctly transpile file into OT-JSON and back',
            async () => {
                const jsonContents = await Utilities.fileContents(inputJsonFile);
                const otJson = transpiler.convertToOTJson(jsonContents);
                assert.isNotNull(otJson, 'Transpilation result is null');

                const wotJsonFromOtJson = transpiler.convertFromOTJson(otJson);

                assert.deepEqual(
                    Utilities.sortedStringify(JSON.parse(jsonContents), true),
                    Utilities.sortedStringify(wotJsonFromOtJson, true),
                    'Converted WOT is not equal to the original one',
                );
            },
        );
    });
});
