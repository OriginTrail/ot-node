const { execSync } = require('child_process');
const Command = require('../command');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const converter = require('json-2-csv');
const split = require('split');
const { finished } = require('stream');
// Constructing promisify from util
const { promisify } = require('util');
const path = require("path");
const constants = require('../../constants');
// Defining finishedAsync method
const finishedAsync = promisify(finished);

class SendTelemetryCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.logFilename = 'active.log';
        this.csvFilename = 'telhub_logs.csv'
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        if(!this.config.telemetryHub.enabled) {
            return Command.empty();
        }
        const otNodeLogsPath = path.join(path.resolve(__dirname, '../../../'), 'logs');
        const intermediateConversionFile = path.join(otNodeLogsPath, `intermediateFile.log`);

        this.logger.info('Started sending telemetry data command');

        try {
            await execSync(`cat ${path.join(otNodeLogsPath, this.logFilename)} | grep \'"level":15\' | grep -v \'level-change\' > ${intermediateConversionFile}`);
        } catch(e) {
            // No data to be send, finish command
            return Command.repeat();
        }

        // Read json objects from log
        let jsonLogObjects = [];
        const readable = fs.createReadStream(intermediateConversionFile)
            .pipe(split(JSON.parse, null, { trailing: false }))
            .on('data', function (obj) {
                jsonLogObjects.push(obj);
            })
            .on('error', function (err) {
                console.log(err);
            });
        await finishedAsync(readable);

        // Convert json objects into csv lines and store them
        await converter.json2csv(jsonLogObjects, (err, csv) => {
                if (err) {
                    throw err;
                }
                fs.writeFileSync(`${path.join(otNodeLogsPath, this.csvFilename)}`, csv);
            },
            { keys:
                [
                    {field:'hostname', title: 'Id_node'}, 'Id_operation', 'Operation_name',
                    'Event_name', {field: 'time', title:'Event_time'}, 'Event_value1',
                    'Event_value2','Event_value3', 'Event_value4'
                ]
            , emptyFieldValue: null});

        // Send csv file to telemetry hub
        let data = new FormData();
        data.append('file', fs.createReadStream(`${path.join(otNodeLogsPath, this.csvFilename)}`));
        try {
            axios({
                method: 'post',
                url: this.config.telemetryHub.url,
                headers: {
                    ...data.getHeaders()
                },
                data : data
            });
        } catch (e) {
            await this.handleError(err);
        }

        // Remove intermediate file
        execSync(`rm ${intermediateConversionFile}`);
        // Make a copy of log file
        const newLogName = `${new Date().toISOString().slice(0, 10)}-${(Math.random() + 1).toString(36).substring(7)}.log`
        await execSync(`cp ${path.join(otNodeLogsPath, this.logFilename)} ${path.join(otNodeLogsPath,newLogName )}`);
        // Truncate log file - leave only last 30 lines
        await execSync(`tail -n30 ${path.join(otNodeLogsPath, this.logFilename)} > ${path.join(otNodeLogsPath, this.logFilename)}`);

        return Command.repeat();
    }

    async recover(command, err) {
        await this.handleError(err);

        return Command.retry();
    }

    async handleError(error) {
        this.logger.error({
            msg:`Error while sending telemetry data to Telemetry hub: ${error}. ${error.stack}`,
            Event_name: constants.ERROR_TYPE.SENDING_TELEMETRY_DATA_ERROR,
        });
    }

    /**
     * Builds default sendTelemetryCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'sendTelemetryCommand',
            delay: 0,
            data: {
                message: '',
            },
            period: 20 * 60 * 1000, // 5 * 60 * 1000
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SendTelemetryCommand;
