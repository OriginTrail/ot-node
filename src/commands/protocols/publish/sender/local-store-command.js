import { OPERATION_ID_STATUS, ERROR_TYPE, PUBLISH_TYPES } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_ERROR;
    }

    async execute(command) {
        const { publishType, operationId, assertionId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );

        switch (publishType) {
            case PUBLISH_TYPES.ASSERTION:
                await this.operationService.localStoreAssertion(assertionId, operationId);
                break;
            case PUBLISH_TYPES.ASSET:
                await this.operationService.localStoreAsset(
                    assertionId,
                    command.data.blockchain,
                    command.data.contract,
                    command.data.tokenId,
                    operationId,
                );
                break;
            case PUBLISH_TYPES.INDEX:
                await this.operationService.localStoreIndex(
                    assertionId,
                    command.data.blockchain,
                    command.data.contract,
                    command.data.tokenId,
                    command.data.keyword,
                    operationId,
                );
                break;
            default:
                throw Error(`Unknown publish type ${publishType}`);
        }

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
