const Command = require('../command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../constants/constants');

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
        const { handlerId, ual, metadata } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START
        );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.INSERTING_ASSERTION,
        );

        const handlerIdData = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const metadataId = this.getMetadataId(handlerIdData.metadata);

        const nquads = [
            `<${ual}> <http://schema.org/metadata> "${metadataId}" .`,
            `<${ual}> <http://schema.org/data> "${metadata.dataRootId}" .`,
        ]
            .concat(handlerIdData.metadata)
            .concat(handlerIdData.data);

        this.logger.info(`Inserting assertion with ual:${ual} in database.`);
        await this.tripleStoreModuleManager.insert(nquads.join('\n'), ual);

        this.logger.info(`Assertion ${ual} has been successfully inserted!`);
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END
        );
        return this.continueSequence(command.data, command.sequence);
    }

    getMetadataId(metadata) {
        return metadata[0].split(' ')[0];
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
            errorType: ERROR_TYPE.INSERT_ASSERTION_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = InsertAssertionCommand;
