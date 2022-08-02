const Command = require('../command');
const { OPERATION_ID_STATUS } = require('../../constants/constants');

class QueryCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.queryService = ctx.queryService;
    }

    async execute(command) {
        const { query, queryType, operationId } = command.data;

        let data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.QUERY.QUERY_START,
        );
        try {
            data = await this.queryService.query(query, queryType);

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.QUERY.QUERY_END,
            );

            await this.operationIdService.cacheOperationIdData(operationId, data);

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.COMPLETED,
            );
        } catch (e) {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                e.message,
            );
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

module.exports = QueryCommand;
