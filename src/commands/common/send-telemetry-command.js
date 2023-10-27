import axios from 'axios';
import { createRequire } from 'module';
import Command from '../command.js';
import { SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES } from '../../constants/constants.js';

const require = createRequire(import.meta.url);
const pjson = require('../../../package.json');

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
    async execute(command) {
        if (!this.config.telemetry.enabled || !this.config.telemetry.sendTelemetryData) {
            return Command.empty();
        }
        try {
            const events = await this.telemetryInjectionService.getUnpublishedEvents();
            const signalingMessage = {
                nodeData: {
                    version: pjson.version,
                    identity: this.networkModuleManager.getPeerId().toB58String(),
                    hostname: this.config.hostname,
                    operational_wallet: this.blockchainModuleManager.getPublicKey(),
                    management_wallet: this.blockchainModuleManager.getManagementKey(),
                    triple_store: this.config.modules.tripleStore.defaultImplementation,
                    auto_update_enabled: this.config.modules.autoUpdater.enabled,
                    multiaddresses: this.networkModuleManager.getMultiaddrs(),
                },
                events: events || [],
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
            if (response.status === 200 && events?.length > 0) {
                await this.telemetryInjectionService.removePublishedEvents(events);
            }
        } catch (err) {
            await this.handleError(command, err);
        }
        return Command.repeat();
    }

    async recover(command, error) {
        this.logger.error(
            `Error occurred during the command execution; ` +
                `Error Message: ${error.message}. Repeating the command...`,
            command,
        );
        return Command.repeat();
    }

    async handleError(command, error) {
        this.logger.error(
            `Error occurred during the command execution; ` +
                `Error Message: ${error.message}. Error Stack: ${error.stack}.`,
            command,
        );
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
