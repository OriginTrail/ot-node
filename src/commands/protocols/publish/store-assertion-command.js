import Command from '../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    TRIPLE_STORE_REPOSITORIES,
    TRIPLETS_VISIBILITY,
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
        // TODO: Change this logic so it handle public/private if it exists
        // If this is only public it will be in dataset
        // If it's both public and private it will be in dataset.public and dataset.private
        try {
            if (Array.isArray(assertion)) {
                await this._insertAssertion(assertion, ual);
            } else {
                const promises = [];
                promises.push(this._insertAssertion(assertion.public, ual));
                if (assertion.private) {
                    promises.push(
                        this._insertAssertion(assertion.private, ual, TRIPLETS_VISIBILITY.PRIVATE),
                    );
                }
                await Promise.all(promises);
            }
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

    async _insertAssertion(assertion, ual, visibility = TRIPLETS_VISIBILITY.PUBLIC) {
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
            visibility,
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
