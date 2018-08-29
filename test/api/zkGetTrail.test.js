require('dotenv').config();
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const path = require('path');
const { Database } = require('arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const GS1Importer = require('../../modules/GS1Importer');
const GS1Utilities = require('../../modules/GS1Utilities');
const WOTImporter = require('../../modules/WOTImporter');
const Importer = require('../../modules/importer');
const Product = require('../../modules/Product');
const Utilities = require('../../modules/Utilities');
const awilix = require('awilix');

function buildSelectedDatabaseParam(databaseName) {
    return {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: databaseName,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database_system: 'arango_db',
        max_path_length: 2000,
    };
}

describe('Check ZK by quering /api/trail for EVENT vertices', () => {
    const databaseName = 'zk-test';
    let graphStorage;
    let systemDb;
    let gs1;
    let product;

    const inputXmlFiles = [
        { args: [path.join(__dirname, '../modules/test_xml/Transformation.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_1.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_2.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_3.xml')] },
        { args: [path.join(__dirname, '../modules/test_xml/GraphExample_4.xml')] },
    ];

    beforeEach('Setup DB', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth(process.env.DB_USERNAME, process.env.DB_PASSWORD);

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
            databaseName,
            [{ username: process.env.DB_USERNAME, passwd: process.env.DB_PASSWORD, active: true }],
        );

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const logger = Utilities.getLogger();
        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName), logger);
        container.register({
            logger: awilix.asValue(Utilities.getLogger()),
            gs1Importer: awilix.asClass(GS1Importer),
            gs1Utilities: awilix.asClass(GS1Utilities),
            graphStorage: awilix.asValue(graphStorage),
            importer: awilix.asClass(Importer),
            wotImporter: awilix.asClass(WOTImporter),
            product: awilix.asClass(Product),
        });
        await graphStorage.connect();
        gs1 = container.resolve('gs1Importer');
        product = container.resolve('product');
    });

    inputXmlFiles.forEach((xmlFile) => {
        let queryObject;
        let myTrail;
        it(`zero knowledge status check for EVENT in ${path.basename(xmlFile.args[0])} file`, async () => {
            await gs1.parseGS1(await Utilities.fileContents(xmlFile.args[0]));
            switch (path.basename(xmlFile.args[0])) {
            case 'Transformation.xml':
                queryObject = { uid: 'CARENGINES_PROVIDER_ID:2015-03-15T00:00:00.000-04:00Z-04:00' };
                break;
            case 'GraphExample_1.xml':
                queryObject = { uid: 'urn:ot:object:actor:id:Company_1:2015-04-17T00:00:00.000-04:00Z-04:00' };
                break;
            case 'GraphExample_2.xml':
                queryObject = { uid: 'SENDER_ID:2015-03-15T00:00:00.000-04:00Z-04:00' };
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
