import Command from '../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../constants/constants.js';

class UpdateAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationIdService = ctx.operationIdService;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_ASSERTION_ERROR;
    }

    async execute(command) {
        const { operationId, ual, blockchain, assertion } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE_FINALIZATION.UPDATE_FINALIZATION_STORE_ASSERTION_START,
        );
        // It should insert old data into historic (both private and public)
        // It should delete old named graph in current (both private and public)
        // It should inset new data into current (both private and public)
        try {
            const knowledgeAssetsCount = this.dataService.countDistinctSubjects(assertion);
            const knowledgeAssetsUALs = [];
            const knowledgeAssetStates = [];
            for (let i = 0; i < knowledgeAssetsCount; i += 1) {
                knowledgeAssetsUALs.push(`${ual}/${i + 1}`);
                knowledgeAssetStates.push(0);
            }

            await this.tripleStoreService.moveAssertionToHistoric(ual);

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
            OPERATION_ID_STATUS.UPDATE_FINALIZATION.UPDATE_FINALIZATION_STORE_ASSERTION_END,
        );

        // TODO: This needs to be changed/fixed when is COMPLETED now with different flow same operation id get's marked completed multiple times
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.COMPLETED,
        );

        return Command.empty();
    }

    // async validateCurrentData() {
    //     const assertionIds = await this.blockchainModuleManager.getAssertionIds(
    //         blockchain,
    //         contract,
    //         tokenId,
    //     );

    //     const assertionIdOfCurrent = assertionIds[assertionIds.length() - 2];
    //     const currentMerkleRoot =
    // }

    /**
     * Builds default updateAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'updateAssertionCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateAssertionCommand;
