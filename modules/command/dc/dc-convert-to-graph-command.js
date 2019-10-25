const Command = require('../command');

class DcConvertToGraphCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.otJsonImporter = ctx.otJsonImporter;
        this.importService = ctx.importService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        await this.importService.startGraphConverterWorker(command);
        return Command.empty();
    }

    /**
     * Builds default dcOfferCreateDbCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcConvertToGraphCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcConvertToGraphCommand;
