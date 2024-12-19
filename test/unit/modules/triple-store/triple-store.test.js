/* import { describe, it, before, beforeEach } from 'mocha';
import chai from 'chai';
import { readFile } from 'fs/promises';
import { formatAssertion, calculateRoot } from 'assertion-tools';
import { TRIPLE_STORE_REPOSITORIES } from '../../../src/constants/constants.js';
import Logger from '../../../src/logger/logger.js';
import TripleStoreModuleManager from '../../../src/modules/triple-store/triple-store-module-manager.js';
import DataService from '../../../src/service/data-service.js';
import assertions from '../../assertions/assertions.js';

const { assert } = chai;

let logger;
let tripleStoreModuleManager;
let dataService;
const config = JSON.parse(await readFile('./test/modules/triple-store/config.json'));
const implementationName = 'ot-blazegraph';

async function _insertAndGet(content) {
    const assertion = await formatAssertion(content);
    const assertionId = calculateRoot(assertion);

    await tripleStoreModuleManager.insertKnowledgeAssets(
        implementationName,
        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
        assertionId,
        assertion.join('\n'),
    );

    const nquads = await tripleStoreModuleManager.getKnowledgeCollection(
        implementationName,
        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
        assertionId,
    );

    const retrievedAssertion = await dataService.toNQuads(nquads, 'application/n-quads');
    const retrievedAssertionId = calculateRoot(retrievedAssertion);

    assert.deepEqual(retrievedAssertion, assertion, `assertions are not equal`);
    assert.equal(retrievedAssertionId, assertionId, `assertion ids are not equal`);
}

describe('Triple store module', () => {
    before('Initialize logger', () => {
        logger = new Logger('trace');
        logger.info = () => {};
    });
    beforeEach('Initialize triple store module manager', async () => {
        tripleStoreModuleManager = new TripleStoreModuleManager({
            config,
            logger,
        });
        await tripleStoreModuleManager.initialize();

        const implementation = tripleStoreModuleManager.getImplementation(implementationName);
        await Promise.all(
            Object.keys(implementation.config.repositories).map((repository) =>
                implementation.module.deleteRepository(repository),
            ),
        );

        await tripleStoreModuleManager.initialize();
    });
    before('Initialize data service', async () => {
        dataService = new DataService({
            logger,
        });
    });
    describe('Insert and get return same assertions:', async () => {
        for (const assertionName in assertions) {
            it(`${assertionName}`, () => _insertAndGet(assertions[assertionName]));
        }
    });
});
 */
