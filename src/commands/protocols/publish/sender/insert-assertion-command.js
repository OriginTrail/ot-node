/* eslint-disable import/extensions */
import Command from '../../../command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class InsertAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.fileService = ctx.fileService;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, ual, assertionId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );
        try {
            await this.operationService.localStore(ual, assertionId, operationId);
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END,
            );

            return this.continueSequence(command.data, command.sequence);
        } catch (error) {
            this.handleError(operationId, error.message, this.errorType, true);
            return Command.empty();
        }
    }

    /**
     * Builds default insertAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'insertAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default InsertAssertionCommand;
