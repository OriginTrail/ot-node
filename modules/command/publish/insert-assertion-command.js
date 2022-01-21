const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');

class InsertAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.dataService = ctx.dataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            documentPath, keywords, assets, handlerId, operationId,
        } = command.data;

        const { rdf, assertion } = await this.fileService.loadJsonFromFile(documentPath);

        try {
            // Store to local graph database
            await this.dataService.insert(rdf.join('\n'), `did:dkg:${assertion.id}`);
            this.logger.info(`Assertion ${assertion.id} is successfully inserted`);
            // await Models.assertions.create({
            //     owner: '',
            //     hash: assertion.id,
            //     signature: '',
            //     topics: keywords.join(','),
            // });
            await Models.handler_ids.update(
                {
                    status: 'COMPLETED',
                }, {
                    where: {
                        handler_id: handlerId,
                    },
                },
            );
        } catch (e) {
            await this.handleError(handlerId, e, constants.ERROR_TYPE.INSERT_ASSERTION_ERROR, true);
        }

        return this.continueSequence(command.data, command.sequence);
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
