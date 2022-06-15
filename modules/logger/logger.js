const pino = require('pino');
const path = require('path');

class Logger {
    constructor(logLevel = 'trace', telemetryHubEnabled) {
        this.logLevel = logLevel;
        this.initialize(logLevel, telemetryHubEnabled);
    }

    initialize(logLevel, telemetryHubEnabled) {
        try {
            const logFilename = path.join(path.resolve(__dirname, '../../'), 'logs/active.log');
            const chosenTargets = [{
                target: './pino-pretty-transport',
                options: {colorize: true},
                level: this.logLevel,
            }];
            if (telemetryHubEnabled) {
                chosenTargets.push({target: 'pino/file', level: this.logLevel, options: {destination: logFilename}});
            }
            this.pinoLogger = pino({
                transport: {
                    targets: chosenTargets,
                },
                customLevels: {
                    emit: 15,
                    api: 25,
                },
                level: logLevel,
            });
        } catch (e) {
            console.error(`Failed to create logger. Error message: ${e.message}`);
        }
    }

    restart() {
        this.initialize(this.logLevel, true);
    }

    fatal(obj) {
        this.pinoLogger.fatal(obj);
    }

    error(obj) {
        this.pinoLogger.error(obj.msg);
        this.pinoLogger.emit({
            msg: `Found error will be reported to Telemetry: ${obj.Event_name}`,
            Operation_name: 'Error',
            Event_name: obj.Event_name,
            Event_value1: obj.Event_value1 ? obj.Event_value1 : '',
            Id_operation: obj.Id_operation ? obj.Id_operation : '',
        });
    }

    warn(obj) {
        this.pinoLogger.warn(obj);
    }

    info(obj) {
        this.pinoLogger.info(obj);
    }

    debug(obj) {
        this.pinoLogger.debug(obj);
    }

    emit(obj) {
        this.pinoLogger.emit(obj);
    }

    trace(obj) {
        this.pinoLogger.trace(obj);
    }

    api(obj) {
        this.pinoLogger.api(obj);
    }

    closeLogger(closingMessage) {
        const finalLogger = pino.final(this.pinoLogger);
        finalLogger.info(closingMessage);
    }
}

module.exports = Logger;
