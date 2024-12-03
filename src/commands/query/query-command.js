import Command from '../command.js';
import {
    TRIPLE_STORE_REPOSITORIES,
    QUERY_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
} from '../../constants/constants.js';

class QueryCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.dataService = ctx.dataService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.paranetService = ctx.paranetService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.QUERY.LOCAL_QUERY_ERROR;
    }

    async execute(command) {
        const { operationId, query, queryType } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            null,
            OPERATION_ID_STATUS.QUERY.QUERY_START,
        );

        let data;

        // TODO: Review federated query logic for V8

        // check if it's federated query
        // const pattern = /SERVICE\s+<([^>]+)>/g;
        // const matches = [];
        // let match;
        // // eslint-disable-next-line no-cond-assign
        // while ((match = pattern.exec(query)) !== null) {
        //     matches.push(match[1]);
        // }
        // if (matches.length > 0) {
        //     for (const repositoryInOriginalQuery of matches) {
        //         const federatedQueryRepositoryName = `http://localhost:9999/blazegraph/namespace/${this.paranetService.getParanetRepositoryName(
        //             repositoryInOriginalQuery,
        //         )}/sparql`;
        //         this.validateRepositoryName(repositoryInOriginalQuery);
        //         query = query.replace(repositoryInOriginalQuery, federatedQueryRepositoryName);
        //     }
        // }
        try {
            switch (queryType) {
                case QUERY_TYPES.CONSTRUCT: {
                    data = await this.tripleStoreService.construct(query);
                    break;
                }
                case QUERY_TYPES.SELECT: {
                    data = await this.dataService.parseBindings(
                        await this.tripleStoreService.select(query),
                    );
                    break;
                }
                default:
                    throw new Error(`Unknown query type ${queryType}`);
            }

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                null,
                OPERATION_ID_STATUS.QUERY.QUERY_END,
            );

            await this.operationIdService.cacheOperationIdData(operationId, data);

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                null,
                OPERATION_ID_STATUS.COMPLETED,
            );
        } catch (e) {
            await this.handleError(operationId, null, e.message, this.errorType, true);
        }

        return Command.empty();
    }

    validateRepositoryName(repository) {
        let isParanetRepoValid = false;
        if (this.ualService.isUAL(repository)) {
            const paranetRepoName = this.paranetService.getParanetRepositoryName(repository);
            isParanetRepoValid = this.config.assetSync?.syncParanets.includes(repository);
            if (isParanetRepoValid) {
                return paranetRepoName;
            }
        }
        const isTripleStoreRepoValid =
            Object.values(TRIPLE_STORE_REPOSITORIES).includes(repository);
        if (isTripleStoreRepoValid) {
            return repository;
        }

        if (!isParanetRepoValid && !isTripleStoreRepoValid) {
            throw new Error(`Query failed! Repository with name: ${repository} doesn't exist`);
        }
    }

    /**
     * Builds default getInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'queryCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default QueryCommand;
