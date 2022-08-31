import axios from 'axios';
import Command from '../command.js';
import pjson from '../../../package.json';
import { SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES } from '../../constants/constants.js';

class SendTelemetryCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.telemetryInjectionService = ctx.telemetryInjectionService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    /**
     * Performs code update by fetching new code from github repo
     * @param command
     */
    async execute() {
        if (!this.config.telemetry.enabled || !this.config.telemetry.sendTelemetryData) {
            return Command.empty();
        }
        try {
            const events = await this.telemetryInjectionService.getUnpublishedEvents();
            if (events && events.length > 0) {
                const signalingMessage = {
                    nodeData: {
                        version: pjson.version,
                        identity: this.networkModuleManager.getPeerId()._idB58String,
                        hostname: this.config.hostname,
                        operational_wallet: this.blockchainModuleManager.getPublicKey(),
                        management_wallet: this.blockchainModuleManager.getManagementKey(),
                        triple_store: this.config.modules.tripleStore.defaultImplementation,
                        auto_update_enabled: this.config.modules.autoUpdater.enabled,
                    },
                    events,
                };
                const config = {
                    method: 'post',
                    url: this.config.telemetry.signalingServerUrl,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify(signalingMessage),
                };
                const response = await axios(config);
                if (response.status === 200) {
                    await this.telemetryInjectionService.removePublishedEvents(events);
                }
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
        this.logger.error(`Error in send telemetry command: ${error}. ${error.stack}`);
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
            period: SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SendTelemetryCommand;
