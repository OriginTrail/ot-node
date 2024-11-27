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
            table.timestampColumn('timestamp', timestamp || Date.now()); // Default to current timestamp in milliseconds
            if (value1 !== null) table.string('value1', value1);
            if (value2 !== null) table.string('value2', value2);
            if (value3 !== null) table.string('value3', value3);

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
