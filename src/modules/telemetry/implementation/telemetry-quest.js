import { Sender } from '@questdb/nodejs-client';

async function sendEventTelemetry(
    operationId = '',
    blockchainId = '',
    name = '',
    timestamp, // Accept timestamp as Unix timestamp (milliseconds)
    value1 = null,
    value2 = null,
    value3 = null
) {
    try {
        // Correct format for configuration string
        const configString = 'http::addr=localhost:10000'; // Adjust with your QuestDB address/port

        // Create sender instance with the proper config string
        const sender = Sender.fromConfig(configString);

        // Set the table to use
        const table = sender.table('event'); // Ensure the table name matches your DB

        // Define the columns in the table
        table.symbol('operationId', operationId || 'NULL');
        table.symbol('blockchainId', blockchainId || 'NULL');
        table.symbol('name', name || 'NULL');

        // Define timestamp as the Unix timestamp in milliseconds
        table.timestampColumn('timestamp', timestamp || Date.now()); // Default to current timestamp in milliseconds

        // Insert value columns if they are provided
        if (value1 !== null) table.string('value1', value1);
        if (value2 !== null) table.string('value2', value2);
        if (value3 !== null) table.string('value3', value3);

        // Send the telemetry data
        await table.at(Date.now(), 'ms'); // Sends data with the current timestamp

        // Flush the buffer to send the data to QuestDB
        await sender.flush();

        // Close the sender connection after sending the data
        await sender.close();

        console.log('Event telemetry logged to QuestDB');
    } catch (err) {
        console.error('Error sending telemetry to QuestDB:', err);
        throw err; // Rethrow error for further handling
    }
}

export default {
    sendEventTelemetry,
};
