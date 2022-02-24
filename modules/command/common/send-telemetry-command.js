const Command = require('../command');
const constants = require('../../constants');
const Models = require('../../../models/index');

class SendTelemetryCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.publishService = ctx.publishService;
        this.telemetryHubModuleManager = ctx.telemetryHubModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        if (!this.config.telemetryHub.enabled) {
            return Command.empty();
        }

        this.telemetryHubModuleManager.aggregateTelemetryData()
            .then((jsonld) => {
                if (jsonld) {
                    Models.handler_ids.create({
                        status: 'PENDING',
                    }).then((insertedObject) => {
                        this.publishService.publish(JSON.stringify(jsonld), '.json', [`ot-telemetry-${Math.floor(new Date() / (60 * 1000))}`], 'public', undefined, insertedObject.dataValues.handler_id, true);
                    });
                }
            })
            .catch((e) => {
                this.handleError(e.message);
            });

        return Command.repeat();
    }

    async recover(command, err) {
        await this.handleError(err);

        return Command.retry();
    }

    async handleError(error) {
        this.logger.error({
            msg: `Error while sending telemetry data to Telemetry hub: ${error}. ${error.stack}`,
            Event_name: constants.ERROR_TYPE.SENDING_TELEMETRY_DATA_ERROR,
        });
    }

    /**
     * Builds default sendTelemetryCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'sendTelemetryCommand',
            delay: 0,
            data: {
                message: '',
            },
            period: 60 * 60 * 1000, // 1 hour
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SendTelemetryCommand;
