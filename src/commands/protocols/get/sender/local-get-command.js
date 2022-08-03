const Command = require('../../../command');
const { OPERATION_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class LocalGetCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.operationIdService = ctx.operationIdService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.getService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_LOCAL_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, assertionId } = command.data;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_LOCAL_START,
        );

        const assertion = await this.getService.localGet(assertionId, operationId);

        if (assertion.length) {
            await this.operationIdService.cacheOperationIdData(operationId, {
                assertion,
            });
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.GET.GET_LOCAL_END,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.GET.GET_END,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.COMPLETED,
            );

            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_LOCAL_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default localGetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localGetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = LocalGetCommand;
