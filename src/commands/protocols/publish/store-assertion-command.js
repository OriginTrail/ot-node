import Command from '../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../constants/constants.js';

class StoreAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationIdService = ctx.operationIdService;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.STORE_ASSERTION_ERROR;
    }

    async execute(command) {
        const { operationId, ual, blockchain, assertion } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_STORE_ASSERTION_START,
        );
        try {
            await this._insertAssertion(assertion, ual);
        } catch (e) {
            await this.handleError(operationId, blockchain, e.message, this.errorType, true);
            return Command.empty(); // TODO: Should it end here or do a retry?
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_STORE_ASSERTION_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    async _insertAssertion(assertion, ual) {
        await this.tripleStoreService.insertKnowledgeCollection(
            TRIPLE_STORE_REPOSITORIES.DKG,
            ual,
            assertion,
        );
    }

    /**
     * Builds default storeAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'storeAssertionCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default StoreAssertionCommand;
