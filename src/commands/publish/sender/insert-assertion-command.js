const Command = require('../../command');
const constants = require('../../../constants/constants');
const {HANDLER_ID_STATUS} = require("../../../constants/constants");

class InsertAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.fileService = ctx.fileService;
        this.handlerIdService = ctx.handlerIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {handlerId, operationId, ual, dataRootId} = command.data;

        await this.handlerIdService.updateHandlerIdStatus(handlerId, HANDLER_ID_STATUS.PUBLISH_INSERTING_ASSERTION);

        const {data, metadata} = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const metadataId = this.getMetadataId(metadata);

        const assertion = [
            `${ual} metadata ${metadataId}`,
            `${ual} data ${dataRootId}`
        ].concat(metadata).concat(data);

        this.logger.info(`Inserting assertion with ual:${ual} in database.`);
        await this.tripleStoreModuleManager.insert(assertion, ual);

        this.logger.info(`Assertion ${ual} has been successfully inserted!`);

        return this.continueSequence(command.data, command.sequence);
    }

    getMetadataId(metadata) {
        return metadata[0].split(' ')[0];
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            handlerId,
        } = command.data;
        await this.handleError(handlerId, err, constants.ERROR_TYPE.INSERT_ASSERTION_ERROR, true);

        return Command.empty();
    }

    /**
     * Builds default insertAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'insertAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = InsertAssertionCommand;
