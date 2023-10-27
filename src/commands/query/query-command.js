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
        } = command.data;

        let data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
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
                default:
                    throw new Error(`Unknown query type ${queryType}`);
            }

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.QUERY.QUERY_END,
            );

            await this.operationIdService.cacheOperationIdData(operationId, data);

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.COMPLETED,
            );
        } catch (err) {
            await this.handleError(operationId, command, this.errorType, err.message, true);
        }

        return Command.empty();
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
