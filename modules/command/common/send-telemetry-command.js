const Command = require('../command');
const constants = require('../../constants');
const Models = require('../../../models/index');
const {v1: uuidv1} = require("uuid");

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

        const operationId = uuidv1();

        this.telemetryHubModuleManager.aggregateTelemetryData()
            .then((jsonld) => {
                if (jsonld) {
                    this.logger.restart();
                    this.initializeTelemetryPublish(operationId);
                    Models.handler_ids.create({
                        status: 'PENDING',
                    }).then((insertedObject) => {
                        const fileContent = JSON.stringify(jsonld);
                        const keywords = [`ot-telemetry-${Math.floor(new Date() / (60 * 1000))}`];
                        this.logger.emit({
                            msg: 'Finished measuring execution of preparing arguments for publishing',
                            Event_name: 'publish_prep_args_end',
                            Operation_name: 'publish_prep_args',
                            Id_operation: operationId,
                        });
                        this.publishService.publish(fileContent, '.json', keywords, 'public', constants.SERVICE_API_ROUTES.PUBLISH, insertedObject.dataValues.handler_id, operationId, true);
                    });
                }
            })
            .catch((e) => {
                this.handleError(e.message);
            });

        return Command.repeat();
    }

    initializeTelemetryPublish(operationId) {
        this.logger.emit({
            msg: 'Started measuring execution of publish command',
            Event_name: 'publish_start',
            Operation_name: 'publish',
            Id_operation: operationId,
        });
        this.logger.emit({
            msg: 'Started measuring execution of check arguments for publishing',
            Event_name: 'publish_init_start',
            Operation_name: 'publish_init',
            Id_operation: operationId,
        });
        this.logger.emit({
            msg: 'Finished measuring execution of check arguments for publishing',
            Event_name: 'publish_init_end',
            Operation_name: 'publish_init',
            Id_operation: operationId,
        });
        this.logger.emit({
            msg: 'Started measuring execution of preparing arguments for publishing',
            Event_name: 'publish_prep_args_start',
            Operation_name: 'publish_prep_args',
            Id_operation: operationId,
        });
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
