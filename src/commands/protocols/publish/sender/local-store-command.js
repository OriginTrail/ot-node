import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const { operationId, assertionId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );

        await this.tripleStoreService.localStoreAsset(
            assertionId,
            command.data.blockchain,
            command.data.contract,
            command.data.tokenId,
            operationId,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default localStoreCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localStoreCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalStoreCommand;
