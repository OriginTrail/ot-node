import { Sender } from '@questdb/nodejs-client';

class TelemetryQuest {
    async initialize(config, logger) {
        this.config = config; // Store configuration if needed
        this.logger = logger; // Assign logger passed from caller
    }

    async sendEventTelemetry(
        operationId = '',
        blockchainId = '',
        name = '',
        timestamp, // Accept timestamp as Unix timestamp (milliseconds)
        value1 = null,
        value2 = null,
        value3 = null
    ) {
        try {
            const configString = 'http::addr=localhost:10000'; // Adjust with your QuestDB address/port
            const sender = Sender.fromConfig(configString);
            const table = sender.table('event'); // Ensure the table name matches your DB

            table.symbol('operationId', operationId || 'NULL');
            table.symbol('blockchainId', blockchainId || 'NULL');
            table.symbol('name', name || 'NULL');
            if (value1 !== null) table.symbol('value1', value1);
            if (value2 !== null) table.symbol('value2', value2);
            if (value3 !== null) table.symbol('value3', value3);
            table.timestampColumn('timestamp', timestamp * 1000);

            await table.at(Date.now(), 'ms'); // Sends data with the current timestamp
            await sender.flush();
            await sender.close();

            this.logger.info('Event telemetry successfully logged to QuestDB');
        } catch (err) {
            this.logger.error(`Error sending telemetry to QuestDB: ${err.message}`);
            throw err; // Rethrow error for further handling
        }
    }
}

export default TelemetryQuest;
