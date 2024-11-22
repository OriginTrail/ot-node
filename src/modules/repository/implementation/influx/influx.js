import { InfluxDB, Point } from '@influxdata/influxdb-client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Dynamically resolve the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamically locate and load the `.env` file
function setEnvParameters() {
    const projectRoot = path.resolve(__dirname, '../../../../..');  // Adjust this path if needed
    const realRoot = fs.realpathSync(projectRoot);  // Resolve symbolic link to real path
    const envPath = path.join(realRoot, '.env');  // Append `.env` to resolved path

    // Check if the `.env` file exists
    if (fs.existsSync(envPath)) {
        //console.log(`Loading environment variables from: ${envPath}`);
        dotenv.config({ path: envPath });  // Load the environment variables
    } else {
        console.error(`.env file not found at: ${envPath}`);
        process.exit(1);  // Exit if `.env` is not found
    }
}

// Call `setEnvParameters` to load the environment variables
setEnvParameters();

// Preconfigure the InfluxDB variables using environment variables
const influxDBUrl = process.env.INFLUXDB_URL;
const influxDBToken = process.env.INFLUXDB_TOKEN;
const influxDBOrg = process.env.INFLUXDB_ORG;
const influxDBBucket = process.env.INFLUXDB_BUCKET;

// Check if required variables are present
if (!influxDBUrl || !influxDBToken || !influxDBOrg || !influxDBBucket) {
    console.error('One or more required environment variables are missing:');
    console.error({
        INFLUXDB_URL: influxDBUrl,
        INFLUXDB_TOKEN: influxDBToken,
        INFLUXDB_ORG: influxDBOrg,
        INFLUXDB_BUCKET: influxDBBucket,
    });
    process.exit(1);  // Exit the script if variables are missing
}

// Initialize the InfluxDB client (use the imported class here)
const influxDBClient = new InfluxDB({
    url: influxDBUrl,
    token: influxDBToken,
});

// Create the write API
const writeApi = influxDBClient.getWriteApi(influxDBOrg, influxDBBucket, 'ns');

// Function to send event telemetry to InfluxDB
export async function sendEventTelemetry(
    operationId,
    blockchainId,
    name,
    timestamp,
    value1 = null,
    value2 = null,
    value3 = null
) {
    try {
        const point = new Point('event')
            .tag('operationId', operationId)
            .tag('blockchainId', blockchainId)
            .stringField('name', name)
            .intField('timestamp', timestamp)
            .stringField('value1', value1 !== null ? value1.toString() : '')
            .stringField('value2', value2 !== null ? value2.toString() : '')
            .stringField('value3', value3 !== null ? value3.toString() : '');

        writeApi.writePoint(point);
        await writeApi.flush();
        //console.log('Event telemetry logged to InfluxDB');
    } catch (err) {
        console.error('Error sending telemetry to InfluxDB:', err);
        throw err;
    }
}

export default {
    sendEventTelemetry,
};
