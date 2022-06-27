const Command = require('../../command');
const { ERROR_TYPE, HANDLER_ID_STATUS } = require('../../../constants/constants');

class GetLatestAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        let { id } = command.data;

        // dkg://did.otp.0x174714134abcd13431413413/987654321/f55da6d1b2e2969c1775073ec00951d52728f83cdc67fea13e5ea636ef45cab0
        if (id.startsWith('dkg://')) {
            const splitted = id.split('/');
            const assertionId = splitted.pop();
            if (assertionId.toLowerCase() === 'latest') {
                const result = await this.blockchainModuleManager.getAssetProofs(
                    splitted[splitted.length - 1],
                );
                if (result) {
                    id = result.assertionId;
                }
            }
        }

        const commandData = command.data;
        commandData.assertionId = id;

        return this.continueSequence(commandData, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.GET_ASSERTION_COMMAND,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default getLatestAssertionIdCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getLatestAssertionIdCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = GetLatestAssertionIdCommand;
