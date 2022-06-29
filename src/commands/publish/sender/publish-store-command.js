const Command = require('../../command');
const { HANDLER_ID_STATUS } = require('../../../constants/constants');

class PublishStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { nodes, handlerId, assertionId, metadata, ual, leftoverNodes } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START,
        );

        const commandSequence = ['publishStoreInitCommand', 'publishStoreRequestCommand'];
        const addCommandPromise = [];
        nodes.forEach((node) => {
            addCommandPromise.push(
                this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: {
                        handlerId,
                        node,
                        assertionId,
                        numberOfFoundNodes: nodes.length,
                        leftoverNodes,
                        metadata,
                        ual,
                    },
                    period: 5000,
                    retries: 3,
                    transactional: false,
                }),
            );
        });

        await Promise.all(addCommandPromise);

        return Command.empty();
    }

    /**
     * Builds default storeInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishStoreCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishStoreCommand;
