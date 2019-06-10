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
const { assert } = chai;
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

describe('GS1 Importer tests', () => {
    let importer;
    let transpiler;

    let arango;
    let graphStorage;
    let selectedDatabase;

    const directoryPath = path.join(__dirname, '../../importers/epcis_12_examples/');
    const inputXmlFiles = fs.readdirSync(directoryPath).map(file => path.join(__dirname, `../../importers/epcis_12_examples/${file}`));

    before('Init EPCIS transpiler', async () => {
        const config = rc(pjson.name, defaultConfig);

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
                    const rawJson = xml2js.xml2js(xmlContents, {
                        compact: true,
                        spaces: 4,
                    });

                    const otJson = transpiler.convertToOTJson(xmlContents);

                    const {
                        data_set_id,
                    } = await importer.importFile({
                        document: otJson,
                    });

                    const otJsonFromDb = await importer.getImport(data_set_id);
                    assert.isNotNull(otJsonFromDb, 'DB result is null');

                    assert.deepEqual(otJson, otJsonFromDb);

                    const xmlFromOtJson = transpiler.convertFromOTJson(otJsonFromDb);
                    const rawJsonFromOtJson = xml2js.xml2js(xmlFromOtJson, {
                        compact: true,
                        spaces: 4,
                    });

                    const sortedFirst = ImportUtilities.sortObjectRecursively(rawJson);
                    const sortedSecond = ImportUtilities.sortObjectRecursively(rawJsonFromOtJson);
                    assert.deepEqual(sortedFirst, sortedSecond, `Converted XML for ${path.basename(test)} is not equal to the original one`);
                },
            );
        });
    });
});
