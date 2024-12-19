import { Sender } from '@questdb/nodejs-client';
import axios from 'axios';

class QuestTelemetry {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.localSender = Sender.fromConfig(this.config.localEndpoint);
        await this.handleEventTable(this.config.localEndpoint);

        if (this.config.sendToSignalingService) {
            this.signalingServiceSender = Sender.fromConfig(this.config.signalingServiceEndpoint);
            await this.handleEventTable(this.config.signalingServiceEndpoint);
        }
    }

    async handleEventTable(endpoint) {
        try {
            const tables = await this.getTables(endpoint);

            // Check if event table already exists
            if (!tables.includes('event')) {
                const createTableQuery = `
                    CREATE TABLE event (
                        operationId STRING,
                        blockchainId SYMBOL,
                        name STRING,
                        timestamp TIMESTAMP,
                        value1 STRING,
                        value2 STRING,
                        value3 STRING
                    ) TIMESTAMP(timestamp) PARTITION BY DAY;
                `;

                const response = await axios.get(endpoint, {
                    params: { query: createTableQuery.trim() },
                });

                if (response?.ddl === 'OK') {
                    this.logger.info('Event table successfully created in QuestDB');
                } else {
                    throw new Error(
                        `Could not create event table in QuestDB. Response: ${JSON.stringify(
                            response,
                        )}`,
                    );
                }
            }
        } catch (error) {
            throw new Error(
                `Failed to handle event table for endpoint: ${endpoint}. Error: ${error.message}`,
            );
        }
    }

    async getTables(endpoint) {
        try {
            const response = await axios.get(endpoint, { params: { query: 'SHOW TABLES;' } });
            return response?.dataset?.flat() || [];
        } catch (error) {
            throw new Error(`Failed to fetch all tables from QuestDB. Error: ${error.message}`);
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

            // this.logger.info('Event telemetry successfully sent to local QuestDB');
        } catch (err) {
            this.logger.error(`Error sending telemetry to local QuestDB: ${err.message}`);
        }
    }
}

export default QuestTelemetry;
