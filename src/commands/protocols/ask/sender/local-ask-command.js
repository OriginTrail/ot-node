import Command from '../../../command.js';
import { OPERATION_REQUEST_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class LocalAskCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.operationService = ctx.askService;
        this.operationIdService = ctx.operationIdService;
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.ASK.ASK_LOCAL_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual } = command.data;

        const knowledgeCollectionsExistArray =
            await this.tripleStoreService.checkIfKnowledgeCollectionsExistInUnifiedGraph(ual);

        const responseData = knowledgeCollectionsExistArray
            ? { knowledgeCollectionsExistArray }
            : {
                  errorMessage: `Unable to find knowledge collections ${ual.join(', ')}`,
              };

        await this.operationService.processResponse(
            command,
            OPERATION_REQUEST_STATUS.COMPLETED,
            responseData,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    async handleError(operationId, blockchain, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(
            operationId,
            blockchain,
            errorMessage,
            errorType,
        );
    }

    /**
     * Builds default localAskCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localAskCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalAskCommand;
