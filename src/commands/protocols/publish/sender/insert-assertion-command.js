const Command = require('../../../command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

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
        const { handlerId, ual, assertionId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );

        const handlerIdData = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const assertionGraphName = `${ual}/${assertionId}`;
        const dataGraphName = `${ual}/${assertionId}/data`;
        const metadatadataGraphName = `${ual}/${assertionId}/metadata`;

        const assertionNquads = [
            `<${assertionGraphName}> <http://schema.org/metadata> <${metadatadataGraphName}> .`,
            `<${assertionGraphName}> <http://schema.org/data> <${dataGraphName}> .`,
        ];

        this.logger.info(`Inserting assertion with ual:${ual} in database.`);

        const insertPromises = [
            this.tripleStoreModuleManager.insert(
                handlerIdData.metadata.join('\n'),
                metadatadataGraphName,
            ),
            this.tripleStoreModuleManager.insert(handlerIdData.data.join('\n'), dataGraphName),
            this.tripleStoreModuleManager.insert(assertionNquads.join('\n'), assertionGraphName),
        ];

        await Promise.all(insertPromises);

        this.logger.info(`Assertion ${assertionId} has been successfully inserted!`);
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END,
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
