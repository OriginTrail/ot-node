import { Sender } from '@questdb/nodejs-client';

class QuestTelemetry {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.localSender = Sender.fromConfig(this.config.localEndpoint);
        if (this.config.sendToSignalingService) {
            this.signalingServiceSender = Sender.fromConfig(this.config.signalingServiceEndpoint);
        }
    }

    listenOnEvents(eventEmitter, onEventReceived) {
        return eventEmitter.on('operation_status_changed', onEventReceived);
    }

    async sendTelemetryData(
        operationId,
        timestamp,
        blockchainId = '',
        name = '',
        value1 = null,
        value2 = null,
        value3 = null,
    ) {
        try {
            const table = this.localSender.table('event');

            table.symbol('operationId', operationId || 'NULL');
            table.symbol('blockchainId', blockchainId || 'NULL');
            table.symbol('name', name || 'NULL');
            if (value1 !== null) table.symbol('value1', value1);
            if (value2 !== null) table.symbol('value2', value2);
            if (value3 !== null) table.symbol('value3', value3);
            table.timestampColumn('timestamp', timestamp * 1000);

            await table.at(Date.now(), 'ms');
            await this.localSender.flush();
            await this.localSender.close();

            this.logger.info('Event telemetry successfully sent to local QuestDB');
        } catch (err) {
            this.logger.error(`Error sending telemetry to local QuestDB: ${err.message}`);
        }
    }
}

export default QuestTelemetry;
