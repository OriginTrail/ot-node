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

export default Logger;
