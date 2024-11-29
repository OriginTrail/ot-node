import 'dotenv/config';
import fs from 'fs-extra';
import rc from 'rc';
import appRootPath from 'app-root-path';
import path from 'path';
import { TRIPLE_STORE_REPOSITORIES, SCHEMA_CONTEXT } from '../src/constants/constants.js';
import TripleStoreModuleManager from '../src/modules/triple-store/triple-store-module-manager.js';
import DataService from '../src/service/data-service.js';
import Logger from '../src/logger/logger.js';

const { readFile } = fs;
const generalConfig = JSON.parse(await readFile(path.join(appRootPath.path, 'config/config.json')));
const pjson = JSON.parse(await readFile(path.join(appRootPath.path, 'package.json')));

const defaultConfig = generalConfig[process.env.NODE_ENV];

const config = rc(pjson.name, defaultConfig);
const logger = new Logger(config.loglevel);

const tripleStoreModuleManager = new TripleStoreModuleManager({ config, logger });
await tripleStoreModuleManager.initialize();
const dataService = new DataService({ config, logger });

const repositoryImplementations = {};
for (const implementationName of tripleStoreModuleManager.getImplementationNames()) {
    for (const repository in tripleStoreModuleManager.getImplementation(implementationName).module
        .repositories) {
        repositoryImplementations[repository] = implementationName;
    }
}

const fromRepository = TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT;
const fromImplementation = repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT];
const fromRepositoryName =
    tripleStoreModuleManager.getImplementation(fromImplementation).module.repositories[
        fromRepository
    ].name;

const toRepository = TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT;
const toImplementation = repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT];
const toRepositoryName =
    tripleStoreModuleManager.getImplementation(toImplementation).module.repositories[toRepository]
        .name;

async function getAssertions(implementation, repository) {
    const graphs = await tripleStoreModuleManager.select(
        implementation,
        repository,
        `SELECT DISTINCT ?g 
        WHERE {
            GRAPH ?g { ?s ?p ?o }
        }`,
    );

    return (graphs ?? []).filter(({ g }) => g.startsWith('assertion:')).map(({ g }) => g);
}

function logPercentage(index, max) {
    const previousPercentage = (Math.max(0, index - 1) / max) * 100;
    const currentPercentage = (index / max) * 100;

    if (Math.floor(currentPercentage) - Math.floor(previousPercentage) < 1) return;

    logger.debug(`Migration at ${Math.floor(currentPercentage * 10) / 10}%`);
}

let toRepositoryAssertions = await getAssertions(toImplementation, toRepository);
logger.info(
    `${toRepositoryAssertions.length} assertions found in ${toRepository} repository before migration`,
);

logger.info(
    `Starting to copy assertions from ${fromImplementation} repository ${fromRepository} with name ${fromRepositoryName} to repository ${toImplementation} repository ${toRepository} with name ${toRepositoryName}`,
);

const fromRepositoryAssertions = await getAssertions(fromImplementation, fromRepository);
logger.info(`${fromRepositoryAssertions.length} assertions found in ${fromRepository}`);

let completed = 0;
const copyAssertion = async (g) => {
    if (!toRepositoryAssertions.includes(g)) {
        let nquads;
        try {
            nquads = await tripleStoreModuleManager.construct(
                fromImplementation,
                fromRepository,
                `PREFIX schema: <${SCHEMA_CONTEXT}>
                    CONSTRUCT { ?s ?p ?o }
                    WHERE {
                        {
                            GRAPH <${g}>
                            {
                                ?s ?p ?o .
                            }
                        }
                    }`,
            );

            nquads = await dataService.toNQuads(nquads, 'application/n-quads');
        } catch (error) {
            logger.error(
                `Error while getting assertion ${g.substring(
                    'assertion:'.length,
                )} from ${fromImplementation} repository ${fromRepository} with name ${fromRepositoryName}. Error: ${
                    error.message
                }`,
            );
            process.exit(1);
        }

        try {
            await tripleStoreModuleManager.insertKnowledgeCollection(
                toImplementation,
                toRepository,
                g.substring('assertion:'.length),
                nquads.join('\n'),
            );
        } catch (error) {
            logger.error(
                `Error while inserting assertion ${g.substring(
                    'assertion:'.length,
                )} with nquads: ${nquads} in ${toImplementation} repository ${toRepository} with name ${toRepositoryName}. Error: ${
                    error.message
                }`,
            );
            process.exit(1);
        }
    }

    completed += 1;
    logPercentage(completed, fromRepositoryAssertions.length);
};

const start = Date.now();
const concurrency = 10;
let promises = [];
for (let i = 0; i < fromRepositoryAssertions.length; i += 1) {
    promises.push(copyAssertion(fromRepositoryAssertions[i]));
    if (promises.length > concurrency) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(promises);
        promises = [];
    }
}
await Promise.all(promises);

const end = Date.now();

logger.info(`Migration completed! Lasted ${(end - start) / 1000} seconds.`);

toRepositoryAssertions = await getAssertions(toImplementation, toRepository);
logger.info(
    `${toRepositoryAssertions.length} assertions found in ${toRepository} repository after migration`,
);
