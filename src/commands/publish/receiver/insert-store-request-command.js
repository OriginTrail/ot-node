const Command = require('../../command');
const { ERROR_TYPE, NETWORK_PROTOCOLS } = require('../../../constants/constants');
const constants = require('../../../constants/constants');

class InsertStoreRequestCommand extends Command {
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
        const { handlerId, ual, dataRootId } = command.data;

        const { data, metadata } = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const metadataId = this.getMetadataId(metadata);

        const nquads = [
            `<${ual}> <http://schema.org/metadata> "${metadataId}" .`,
            `<${ual}> <http://schema.org/data> "${dataRootId}" .`,
        ]
            .concat(metadata)
            .concat(data);

        this.logger.info(`Inserting assertion with ual:${ual} in database.`);
        await this.tripleStoreModuleManager.insert(nquads.join('\n'), ual);

        this.logger.info(`Assertion ${ual} has been successfully inserted!`);
        return this.continueSequence(command.data, command.sequence);
    }

    getMetadataId(metadata) {
        return metadata[0].split(' ')[0];
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        this.logger.error({
            msg: errorMessage,
        });

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.STORE,
            commandData.remotePeerId,
            messageType,
            handlerId,
            messageData,
        );
        return Command.empty();
    }

    /**
     * Builds default insertAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'insertStoreRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.INSERT_ASSERTION_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = InsertStoreRequestCommand;
