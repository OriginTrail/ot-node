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
        this.networkModuleManager = ctx.networkModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.telemetryModuleManager = ctx.telemetryModuleManager;
    }

    /**
     * Performs code update by fetching new code from github repo
     * @param command
     */
    async execute() {
        if (
            !this.config.modules.telemetry.enabled ||
            !this.telemetryModuleManager.getModuleConfiguration().sendTelemetryData
        ) {
            return Command.empty();
        }

        try {
            const events = (await this.getUnpublishedEvents()) || [];
            const nodeData = {
                version: pjson.version,
                identity: this.networkModuleManager.getPeerId().toB58String(),
                hostname: this.config.hostname,
                triple_store: this.config.modules.tripleStore.defaultImplementation,
                auto_update_enabled: this.config.modules.autoUpdater.enabled,
                multiaddresses: this.networkModuleManager.getMultiaddrs(),
                blockchains: await this.blockchainModuleManager.getBlockchainsNodeInfo(),
            };
            const isDataSuccessfullySent = await this.telemetryModuleManager.sendTelemetryData(
                nodeData,
                events,
            );
            if (isDataSuccessfullySent && events?.length > 0) {
                await this.removePublishedEvents(events);
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

    async getUnpublishedEvents() {
        return this.repositoryModuleManager.getUnpublishedEvents();
    }

    async removePublishedEvents(events) {
        const ids = events.map((event) => event.id);

        await this.repositoryModuleManager.destroyEvents(ids);
    }
}

export default SendTelemetryCommand;
