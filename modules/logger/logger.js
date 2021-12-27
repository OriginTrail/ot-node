const pino = require('pino');
const path = require('path');

class Logger {
    static create(logLevel = 'trace', telemetryHubEnabled) {
        try {
            const logFilename = path.join(path.resolve(__dirname, '../../'), 'logs/active.log');
            let chosenTargets = [];
            if (telemetryHubEnabled) {
                chosenTargets = [
                    { target: './pino-pretty-transport', options: { colorize: true }, level: 'trace' },
                    { target: 'pino/file', level: 'trace', options: { destination: logFilename } },
                ];
            } else {
                chosenTargets = [
                    { target: './pino-pretty-transport', options: { colorize: true }, level: 'trace' },
                ];
            }

            const logger = pino({
                transport: {
                    targets: chosenTargets,
                },
                customLevels: {
                    emit: 15,
                },
                level: logLevel,
            });

            return logger;
        } catch (e) {
            console.error(`Failed to create logger. Error message: ${e.message}`);
        }
    }
}

module.exports = Logger;
