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
            const knowledgeAssetsCount = this.dataService.countDistinctSubjects(assertion);
            const knowledgeAssetsUALs = [];
            const knowledgeAssetStates = [];
            for (let i = 0; i < knowledgeAssetsCount; i += 1) {
                knowledgeAssetsUALs.push(`${ual}/${i + 1}`);
                knowledgeAssetStates.push(0);
            }

            // eslint-disable-next-line no-await-in-loop
            await this.tripleStoreService.insertKnowledgeCollection(
                TRIPLE_STORE_REPOSITORIES.DKG,
                ual,
                knowledgeAssetsUALs,
                knowledgeAssetStates,
                assertion,
            );
        } catch (e) {
            await this.handleError(operationId, blockchain, e.message, this.errorType, true);
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_STORE_ASSERTION_END,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.COMPLETED,
        );

        return Command.empty();
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