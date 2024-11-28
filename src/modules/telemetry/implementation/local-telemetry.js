import { Sender } from '@questdb/nodejs-client';

class TelemetryQuest {
    async initialize(config, logger) {
        this.config = config; 
        this.logger = logger; 
    }

    async sendEventTelemetry(
        operationId = '',
        blockchainId = '',
        name = '',
        timestamp, 
        value1 = null,
        value2 = null,
        value3 = null
    ) {
        try {
            const configString = 'http::addr=localhost:10000'; 
            const sender = Sender.fromConfig(configString);
            const table = sender.table('event'); 

            table.symbol('operationId', operationId || 'NULL');
            table.symbol('blockchainId', blockchainId || 'NULL');
            table.symbol('name', name || 'NULL');
            if (value1 !== null) table.symbol('value1', value1);
            if (value2 !== null) table.symbol('value2', value2);
            if (value3 !== null) table.symbol('value3', value3);
            table.timestampColumn('timestamp', timestamp * 1000);

            await table.at(Date.now(), 'ms'); 
            await sender.flush();
            await sender.close();

            this.logger.info('Event telemetry successfully logged to QuestDB');
        } catch (err) {
            this.logger.error(`Error sending telemetry to QuestDB: ${err.message}`);
            throw err; 
        }
    }
}

export default TelemetryQuest;
