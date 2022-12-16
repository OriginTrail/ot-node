import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.publishService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const { operationId, assertionId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );

        await this.publishService.localStoreAsset(
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

        if (this.config.privateNode) {
            await this.publishService.markOperationAsCompleted(operationId, {}, [
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_END,
                OPERATION_ID_STATUS.COMPLETED,
            ]);
            this.logger.info('Network publish skipped node is running in private mode');
            this.logger.info(`Publish with operation id: ${operationId} completed!`);
            return Command.empty();
        }
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
