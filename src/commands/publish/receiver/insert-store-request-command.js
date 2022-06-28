const Command = require('../../command');
const { ERROR_TYPE } = require('../../../constants/constants');

class InsertStoreRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.fileService = ctx.fileService;
        this.handlerIdService = ctx.handlerIdService;

        this.publishService = ctx.publishService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId, ual, assertionId } = command.data;

        const { data, metadata } = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const assertionGraphName = `${ual}/${assertionId}`;
        const dataGraphName = `${ual}/${assertionId}#data`;
        const metadatadataGraphName = `${ual}/${assertionId}#metadata`;

        const assertionNquads = [
            `<${assertionGraphName}> <http://schema.org/metadata> <${metadatadataGraphName}> .`,
            `<${assertionGraphName}> <http://schema.org/data> <${dataGraphName}> .`,
        ];

        this.logger.info(`Inserting assertion with ual:${ual} in database.`);

        const insertPromises = [
            this.tripleStoreModuleManager.insert(metadata.join('\n'), metadatadataGraphName),
            this.tripleStoreModuleManager.insert(data.join('\n'), dataGraphName),
            this.tripleStoreModuleManager.insert(assertionNquads.join('\n'), assertionGraphName),
        ];

        await Promise.all(insertPromises);

        this.logger.info(`Assertion ${ual} has been successfully inserted!`);
        return this.continueSequence(command.data, command.sequence);
    }

    getMetadataId(metadata) {
        return metadata[0].split(' ')[0];
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        await this.publishService.handleReceiverCommandError(
            handlerId,
            errorMessage,
            errorName,
            markFailed,
            commandData,
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
