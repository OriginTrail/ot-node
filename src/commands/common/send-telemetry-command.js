const axios = require('axios');
const Command = require('../command');
const constants = require('../../constants/constants');
const pjson = require('../../../package.json');

class SendTelemetryCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.telemetryInjectionService = ctx.telemetryInjectionService;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Performs code update by fetching new code from github repo
     * @param command
     */
    async execute() {
        if (process.env.NODE_ENV !== 'testnet') {
            return Command.empty();
        }
        try {
            const events = await this.telemetryInjectionService.getUnpublishedEvents();
            if (events && events.length > 0) {
                const signalingMessage = {
                    nodeData: {
                        version: pjson.version,
                        identity: 'veryMuchRandom',
                        hostname: 'someTestnetNode',
                    },
                    events,
                };
                const config = {
                    method: 'post',
                    url: this.config.signalingServerUrl,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify(signalingMessage),
                };
                await axios(config);

                await this.telemetryInjectionService.removePublishedEvents(events);
            }
        } catch (e) {
            await this.handleError(e);
        }
        return Command.repeat();
    }

    async recover(command, err) {
        await this.handleError(err);

        return Command.repeat();
    }

    async handleError(error) {
        this.logger.error({
            msg: `Error in send telemetry command: ${error}. ${error.stack}`,
            Event_name: constants.ERROR_TYPE.SENDING_TELEMETRY_DATA_ERROR,
            Event_value1: error.message,
        });
    }

    /**
     * Builds default otnodeUpdateCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'sendTelemetryCommand',
            delay: 0,
            data: {},
            period: 5 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SendTelemetryCommand;
