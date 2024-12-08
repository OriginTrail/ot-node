import { kcTools } from 'assertion-tools';
import Command from '../../command.js';
import {
    // OPERATION_ID_STATUS,
    ERROR_TYPE,
    TRIPLE_STORE_REPOSITORY,
    TRIPLES_VISIBILITY,
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
        const { operationId, ual, blockchain, assertion, firstNewKAIndex, updateStateIndex } =
            command.data;
        const validateCurrentData = this.validateCurrentData(ual);
        if (this.validateCurrentData(validateCurrentData)) {
            const preUpdateUalNamedGraphs =
                // Old subjects old ual from select returned here probably {s, g}
                await this.tripleStoreService.moveToHistoricAndDeleteAssertion(
                    ual,
                    updateStateIndex - 1,
                );

            await this.tripleStoreService.insertUpdatedKnowledgeCollection(
                preUpdateUalNamedGraphs,
                ual,
                assertion,
                firstNewKAIndex,
            );
        } else {
            await this.handleError(
                operationId,
                blockchain,
                `Data in current DKG doesn't match pre update data for ${ual}.`,
                ERROR_TYPE.UPDATE_FINALIZATION.UPDATE_FINALIZATION_NO_OLD_DATA,
                true,
            );
        }

        return Command.empty();
    }

    // TODO: Move maybe outside of the command into metadata validation command (but it's not metadata)
    async validateCurrentData(ual) {
        const { blockchain, contract, knowledgeCollectionId } = this.ualService.resolveUAL(ual);
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            knowledgeCollectionId,
        );
        const assertionIdOfCurrent = assertionIds[assertionIds.length() - 2];

        const preUpdateAssertion = await this.tripleStoreService.getKnowledgeAssetNamedGraph(
            TRIPLE_STORE_REPOSITORY.DKG,
            ual,
            TRIPLES_VISIBILITY.PUBLIC,
        );

        const preUpdateMerkleRoot = kcTools.calculateMerkleRoot(preUpdateAssertion);

        return assertionIdOfCurrent === preUpdateMerkleRoot;
    }

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
