import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import Command from '../../../command.js';
import { OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class GetValidateAssetCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
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
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, contract, tokenId, ual } = command.data;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_START,
        );

        const isUAL = this.ualService.isUAL(ual);

        if (!isUAL) {
            await this.handleError(
                operationId,
                blockchain,
                `Get for operation id: ${operationId}, UAL: ${ual}: is not a UAL.`,
                this.errorType,
            );
            return Command.empty();
        }
        const isValidUal = await this.validationService.validateUal(blockchain, contract, tokenId);

        if (!isValidUal) {
            await this.handleError(
                operationId,
                blockchain,
                `Get for operation id: ${operationId}, UAL: ${ual}: there is no asset with this UAL.`,
                this.errorType,
            );
            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_END,
        );
        return this.continueSequence(
            { ...command.data, retry: undefined, period: undefined },
            command.sequence,
        );
    }

    /**
     * Builds default getValidateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getValidateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetValidateAssetCommand;
