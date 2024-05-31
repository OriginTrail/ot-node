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

        this.errorType = ERROR_TYPE.QUERY.LOCAL_QUERY_ERROR;
    }

    async execute(command) {
        const {
            queryType,
            operationId,
            repository = TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
        } = command.data;

        let { query } = command.data;

        let data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            null,
            OPERATION_ID_STATUS.QUERY.QUERY_START,
        );
        this.validateRepositoryName(repository);
        // check if it's federated query
        const pattern = /SERVICE\s+<[^>]+>/g;
        const matches = query.match(pattern);
        if (matches) {
            for (const repositoryInOriginalQuery in matches) {
                const federatedQueryRepositoryName =
                    this.paranetService.getParanetRepositoryByParanetName(
                        repositoryInOriginalQuery,
                    );
                this.validateRepositoryName(federatedQueryRepositoryName);
                query = query.replace(repositoryInOriginalQuery, federatedQueryRepositoryName);
            }
        }
        try {
            switch (queryType) {
                case QUERY_TYPES.CONSTRUCT: {
                    data = await this.tripleStoreService.construct(repository, query);
                    break;
                }
                case QUERY_TYPES.SELECT: {
                    data = await this.dataService.parseBindings(
                        await this.tripleStoreService.select(repository, query),
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
        if (
            this.config.assetSync?.syncParanets.indexOf(
                this.paranetService.getParanetRepositoryByParanetName(repository),
            ) === -1 &&
            TRIPLE_STORE_REPOSITORIES.indexOf(repository) === -1
        ) {
            throw Error(`Query failed! Repository with name: ${repository} doesn't exist`);
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
