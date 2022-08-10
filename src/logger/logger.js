const pino = require('pino');
const path = require('path');
const { existsSync } = require('fs');
const { mkdirpSync } = require('fs-extra');

class Logger {
    constructor(logLevel = 'trace', telemetryHubEnabled) {
        this.logLevel = logLevel;
        this.initialize(logLevel, telemetryHubEnabled);
    }

    initialize(logLevel, telemetryHubEnabled) {
        try {
            const logFilename = path.join(path.resolve(__dirname, '../../'), 'logs/active.log');
            const logDirname = path.join(path.resolve(__dirname, '../../'), 'logs');
            if (!existsSync(logDirname)) {
                mkdirpSync(logDirname);
            }
            const chosenTargets = [
                {
                    target: './pino-pretty-transport',
                    options: { colorize: true },
                    level: this.logLevel,
                },
            ];
            if (telemetryHubEnabled) {
                chosenTargets.push({
                    target: 'pino/file',
                    level: this.logLevel,
                    options: { destination: logFilename },
                });
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
            // eslint-disable-next-line no-console
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
        this.pinoLogger.error(obj);
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
