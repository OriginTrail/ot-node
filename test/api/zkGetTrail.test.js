require('dotenv').config();

const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const path = require('path');
const { Database } = require('arangojs');
const awilix = require('awilix');
const rc = require('rc');
const Web3 = require('web3');
const GraphStorage = require('../../modules/Database/GraphStorage');
const GS1Utilities = require('../../modules/importer/gs1-utilities');
const WOTImporter = require('../../modules/importer/wot-importer');
const Product = require('../../modules/Product');
const Utilities = require('../../modules/Utilities');
const ImportService = require('../../modules/service/import-service');
const EpcisOtJsonTranspiler = require('../../modules/transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('../../modules/transpiler/wot/wot-otjson-transpiler');


const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');
const logger = require('../../modules/logger');

describe('Check ZK by quering /api/trail for EVENT vertices', () => {
    const databaseName = 'zk-test';
    let graphStorage;
    let systemDb;
    let importService;
    let product;
    let epcisOtJsonTranspiler;

    const inputXmlFiles = [
        { args: [path.join(__dirname, '../modules/test_xml/Transformation.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_1.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_2.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_3.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_4.xml')] },
    ];

    beforeEach('Setup DB', async () => {
        const config = rc(pjson.name, defaultConfig);

        config.erc725Identity = '0x611d771aAfaa3D6Fb66c4a81D97768300a6882D5';
        config.node_wallet = '0xa9a07f3c53ec5de8dd83039ca27fae83408e16f5';
        config.node_private_key = '952e45854ca5470a6d0b6cb86346c0e9c4f8f3a5a459657df8c94265183b9253';

        systemDb = new Database();
        systemDb.useBasicAuth(config.database.username, config.database.password);

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
            databaseName,
            [{
                username: config.database.username,
                passwd: config.database.password,
                active: true,
            }],
        );

        config.database.database = databaseName;

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt'));

        graphStorage = new GraphStorage(config.database, logger, () => {});
        container.register({
            logger: awilix.asValue(logger),
            gs1Utilities: awilix.asClass(GS1Utilities),
            graphStorage: awilix.asValue(graphStorage),
            wotImporter: awilix.asClass(WOTImporter),
            product: awilix.asClass(Product),
            config: awilix.asValue(config),
            notifyError: awilix.asValue(() => {}),
            importService: awilix.asClass(ImportService).singleton(),
            epcisOtJsonTranspiler: awilix.asClass(EpcisOtJsonTranspiler).singleton(),
            wotOtJsonTranspiler: awilix.asClass(WotOtJsonTranspiler).singleton(),
            web3: awilix.asValue(web3),
        });
        await graphStorage.connect();
        importService = container.resolve('importService');
        epcisOtJsonTranspiler = container.resolve('epcisOtJsonTranspiler');
        product = container.resolve('product');
    });

    inputXmlFiles.forEach((xmlFile) => {
        let queryObject;
        let myTrail;
        it(`zero knowledge status check for EVENT in ${path.basename(xmlFile.args[0])} file`, async () => {
            await importService.importFile({
                document:
                    epcisOtJsonTranspiler
                        .convertToOTJson(await Utilities.fileContents(xmlFile.args[0])),
            });
            switch (path.basename(xmlFile.args[0])) {
            case 'Transformation.xml':
                queryObject = { uid: 'urn:ot:object:actor:id:Car.Engines:2015-03-15T00:00:00.000-04:00Z-04:00' };
                break;
            case 'GraphExample_1.xml':
                queryObject = { uid: 'urn:ot:object:actor:id:Company_1:2015-04-17T00:00:00.000-04:00Z-04:00' };
                break;
            case 'GraphExample_2.xml':
                queryObject = { uid: 'urn:ot:object:actor:id:Company _1:2015-03-15T00:00:00.000-04:00Z-04:00' };
                break;
            case 'GraphExample_3.xml':
                queryObject = { uid: 'urn:ot:object:actor:id:Company_2:2015-04-17T00:00:00.000-04:00Z-04:00' };
                break;
            case 'GraphExample_4.xml':
                // no event in this xml file, thus nothing to query
                queryObject = { uid: '' };
                break;
            default:
                throw Error(`Not implemented for ${path.basename(xmlFile.args[0])}`);
            }

            myTrail = await product.getTrailByQuery(queryObject);

            Object.keys(myTrail).forEach((key, index) => {
                if (myTrail[key].vertex_type === 'EVENT') {
                    switch (path.basename(xmlFile.args[0])) {
                    case 'Transformation.xml':
                        assert.equal(myTrail[key].zk_status, 'PASSED', 'ZK should pass');
                        break;
                    case 'GraphExample_1.xml':
                        assert.equal(myTrail[key].zk_status, 'PASSED', 'ZK should pass');
                        break;
                    case 'GraphExample_2.xml':
                        assert.equal(myTrail[key].zk_status, 'PASSED', 'ZK should pass');
                        break;
                    case 'GraphExample_3.xml':
                        assert.equal(myTrail[key].zk_status, 'PASSED', 'ZK should pass');
                        break;
                    case 'GraphExample_4.xml':
                        // no ZK triggered at all, thus no assert
                        break;
                    default:
                        throw Error(`Not implemented for ${path.basename(xmlFile.args[0])}`);
                    }
                }
            });
        });
    });

    afterEach('Drop DB', async () => {
        if (systemDb) {
            const listOfDatabases = await systemDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await systemDb.dropDatabase(databaseName);
            }
        }
    });
});
