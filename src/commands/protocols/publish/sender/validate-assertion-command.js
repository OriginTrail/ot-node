const Command = require('../../../command');
const { ERROR_TYPE, HANDLER_ID_STATUS } = require('../../../../constants/constants');

class ValidateAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual, handlerId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_START,
        );
        const assertionId = await this.operationService
            .validateAssertion(ual, handlerId)
            .catch((e) =>
                this.handleError(handlerId, e.message, ERROR_TYPE.VALIDATE_ASSERTION_ERROR, true),
            );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_END,
        );

        return this.continueSequence({ ...command.data, assertionId }, command.sequence);
    }

    /**
     * Builds default prepareAssertionForPublish
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'validateAssertionCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.VALIDATE_ASSERTION_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ValidateAssertionCommand;
