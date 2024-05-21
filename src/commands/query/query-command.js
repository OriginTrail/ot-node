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

        this.errorType = ERROR_TYPE.QUERY.LOCAL_QUERY_ERROR;
    }

    async execute(command) {
        const {
            query,
            queryType,
            operationId,
            repository = TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
            repositories,
            filters,
        } = command.data;

        let data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            null,
            OPERATION_ID_STATUS.QUERY.QUERY_START,
        );
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
                case QUERY_TYPES.FEDERATED_QUERY: {
                    if (repositories.length !== filters.length) {
                        throw new Error(
                            `For federated query repositories and filters need to be of same length`,
                        );
                    }
                    const federatedQuery = this.buildFederatedQuery(query, repositories, filters);
                    data = await this.dataService.parseBindings(
                        await this.tripleStoreService.select(repository, federatedQuery),
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

    buildFederatedQuery(query, services, filters) {
        let federatedQuery = query;
        const indexOfWhere = query.indexOf('WHERE');
        const firstBraceOfWhereIndex = query.indexOf('{', indexOfWhere);
        let curlyBracesCounter = 0;
        for (let i = firstBraceOfWhereIndex; i < query.length; i += 1) {
            if (query[i] === '{') {
                curlyBracesCounter += 1;
            } else if (query[i] === '}') {
                curlyBracesCounter -= 1;
                if (curlyBracesCounter === 0) {
                    let positionToInsert = i;
                    for (let j = 0; j < services.length; j += 1) {
                        const serviceString = this.buildServiceFilter(services[i], filters[i]);
                        federatedQuery = this.insertStringAtPosition(
                            federatedQuery,
                            serviceString,
                            positionToInsert,
                        );
                        positionToInsert += serviceString.length;
                    }
                }
            }
        }
    }

    buildServiceFilter(repository, filter) {
        // http://192.168.206.131:9999/blazegraph/namespace/second_namespace/sparql endpoint
        const paranetRepo = this.tripleStoreService.getRepositorySparqlEndpoint(repository);
        return `
        SERVICE <${paranetRepo}> {
            ${filter}
        }`;
    }

    insertStringAtPosition(originalString, stringToInsert, position) {
        let positionToBeUsed = position;
        if (position < 0) {
            positionToBeUsed = 0;
        } else if (position > originalString.length) {
            positionToBeUsed = originalString.length;
        }

        // Use slice to divide the original string and insert the new string
        return (
            originalString.slice(0, positionToBeUsed) +
            stringToInsert +
            originalString.slice(positionToBeUsed)
        );
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
