import pino from 'pino';
import fs from 'fs';

// Ensure logs directory exists
const LOG_DIR = './logs';
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const timers = new Map();

const baseLogger = pino({
    transport: {
        targets: [
            {
                target: 'pino-pretty',
                level: 'info',
                options: {
                    colorize: true,
                    translateTime: 'yyyy-mm-dd HH:MM:ss',
                },
            },
            {
                target: 'pino-pretty',
                level: 'info',
                options: {
                    destination: `${LOG_DIR}/migration.log`,
                    colorize: false,
                    translateTime: 'yyyy-mm-dd HH:MM:ss',
                },
            },
        ],
    },
});

// Create enhanced logger with proper method binding
const logger = {
    // Bind all methods from the base logger
    info: baseLogger.info.bind(baseLogger),
    error: baseLogger.error.bind(baseLogger),
    warn: baseLogger.warn.bind(baseLogger),
    debug: baseLogger.debug.bind(baseLogger),

    // Add our custom timing methods
    time(label) {
        timers.set(label, performance.now());
    },
    timeEnd(label) {
        const start = timers.get(label);
        if (!start) {
            this.warn(`Timer '${label}' does not exist`);
            return;
        }
        const duration = (performance.now() - start).toFixed(3);
        timers.delete(label);
        this.info(`${label}: ${duration}ms`);
        return duration;
    },
};

export default logger;
