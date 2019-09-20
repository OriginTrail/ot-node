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
const EpcisOtJsonImporter = require('../../modules/importer/ot-json-importer');
const EpcisOtJsonTranspiler = require('../../modules/transpiler/epcis/epcis-otjson-transpiler');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

const databaseName = 'ot-json-importer-test-db';

describe('EPCIS OT JSON transpiler tests', () => {
    let importer;
    let transpiler;

    let arango;
    let graphStorage;
    let selectedDatabase;

    const directoryPath = path.join(__dirname, '../../importers/epcis_12_examples/');
    const inputXmlFiles = fs.readdirSync(directoryPath).map(file => path.join(__dirname, `../../importers/epcis_12_examples/${file}`));

    before('Init EPCIS transpiler', async () => {
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
        transpiler = new EpcisOtJsonTranspiler({
            web3,
            config,
        });

        importer = new EpcisOtJsonImporter({
            graphStorage,
            logger,
            config,
            notifyError: {},
            web3,
        });
    });

    describe('Convert XMLs into OT-JSON and vice versa', () => {
        inputXmlFiles.forEach((test) => {
            it(
                `should correctly transpile ${path.basename(test)} into OT-JSON and back`,
                // eslint-disable-next-line no-loop-func
                async () => {
                    const xmlContents = await Utilities.fileContents(test);
                    const expectedJson = xml2js.xml2js(xmlContents, {
                        compact: true,
                        spaces: 4,
                    });
                    const otJson = transpiler.convertToOTJson(xmlContents);
                    assert.isNotNull(otJson, 'Transpilation result is null');

                    const xmlFromOtJson = transpiler.convertFromOTJson(otJson);
                    const returnedJson = xml2js.xml2js(xmlFromOtJson, {
                        compact: true,
                        spaces: 4,
                    });

                    assert.deepEqual(
                        Utilities.sortedStringify(expectedJson, true),
                        Utilities.sortedStringify(returnedJson, true),
                        `Converted XML for ${path.basename(test)} is not equal to the original one`,
                    );
                },
            );
        });
    });

    describe('Convert empty XML into OT-JSON', () => {
        it('should fail on empty XML document', async () => {
            expect(transpiler.convertToOTJson.bind(transpiler, null)).to.throw('XML document cannot be empty');
        });
    });

    describe('Convert empty OT-JSON into XML', () => {
        it('should fail on empty OT-JSON document', async () => {
            expect(transpiler.convertFromOTJson.bind(transpiler, null)).to.throw('OT-JSON document cannot be empty');
        });
    });
});
