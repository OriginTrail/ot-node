import { pino } from 'pino';
import pretty from 'pino-pretty';

class Logger {
    constructor(logLevel = 'trace') {
        this.logLevel = logLevel;
        this.initialize(logLevel);
    }

    initialize(logLevel) {
        try {
            const stream = pretty({
                colorize: true,
                level: this.logLevel,
                translateTime: 'yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname,Event_name,Operation_name,Id_operation',
                hideObject: true,
                messageFormat: (log, messageKey) => `${log[messageKey]}`,
            });
            this.pinoLogger = pino(
                {
                    customLevels: {
                        emit: 15,
                        api: 25,
                    },
                    level: logLevel,
                },
                stream,
            );
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(`Failed to create logger. Error message: ${e.message}`);
        }
    }

    log(level, obj, commandMetadata = {}) {
        const commandMetadataStr = commandMetadata.name
            ? this._formatCommandMetadata(commandMetadata)
            : '';
        const objStr = typeof obj === 'object' ? JSON.stringify(obj) : obj;
        const logStr = `${commandMetadataStr}${objStr}`;
        this.pinoLogger[level](logStr);
    }

    restart() {
        this.initialize(this.logLevel, true);
    }

    fatal(obj, commandMetadata = {}) {
        this.log('fatal', obj, commandMetadata);
    }

    error(obj, commandMetadata = {}) {
        this.log('error', obj, commandMetadata);
    }

    warn(obj, commandMetadata = {}) {
        this.log('warn', obj, commandMetadata);
    }

    info(obj, commandMetadata = {}) {
        this.log('info', obj, commandMetadata);
    }

    debug(obj, commandMetadata = {}) {
        this.log('debug', obj, commandMetadata);
    }

    emit(obj, commandMetadata = {}) {
        this.log('emit', obj, commandMetadata);
    }

    trace(obj, commandMetadata = {}) {
        this.log('trace', obj, commandMetadata);
    }

    api(obj, commandMetadata = {}) {
        this.log('api', obj, commandMetadata);
    }

    closeLogger(closingMessage) {
        const finalLogger = pino.final(this.pinoLogger);
        finalLogger.info(closingMessage);
    }

    _formatCommandMetadata(commandMetadata) {
        const commandIdStr = commandMetadata.id ? ` (${commandMetadata.id})` : '';
        return `${commandMetadata.name}${commandIdStr}: `;
    }
}

export default Logger;
