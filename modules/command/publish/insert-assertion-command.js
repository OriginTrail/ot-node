const Command = require('../command');
const Models = require('../../../models/index');

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
            assertion, rdf, keywords, assets, handlerId,
        } = command.data;

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
            this.logger.warn(`Error while storing dataset to local database: ${e.message}`);
            this.logger.emit({
                msg: 'Telemetry logging error at insert assertion command',
                Operation_name: 'Error',
                Event_name: 'InsertAssertionError',
                Event_value1: e.message,
                Id_operation: 'Undefined',
            });
        }

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default dcConvertToOtJsonCommand
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
