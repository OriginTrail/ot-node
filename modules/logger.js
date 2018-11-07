const winston = require('winston');
require('winston-daily-rotate-file');
// eslint-disable-next-line
require('winston-papertrail').Papertrail;
require('winston-loggly-bulk');
const runtimeConfigJson = require('../config/config.json')[process.env.NODE_ENV];

const colors = require('colors/safe');

class Logger {
    constructor() {
        this.logger = Logger._create();
    }

    /**
     * Create logger
     * @return {Logger|*}
     * @private
     */
    static _create() {
        let logLevel = 'trace';
        if (process.env.LOGS_LEVEL_DEBUG) {
            logLevel = 'debug';
        }

        try {
            const transports =
                [
                    new (winston.transports.Console)({
                        colorize: 'all',
                        timestamp: true,
                        formatter: args => `${new Date().toISOString()} - ${Logger.colorize(args.level)} - ${Logger.colorize(args.level, args.message)}`,
                        stderrLevels: [
                            'trace',
                            'notify',
                            'debug',
                            'info',
                            'warn',
                            'important',
                            'error',
                            'api',
                            'job',
                        ],
                    }),
                    new (winston.transports.DailyRotateFile)({
                        filename: 'otnode-%DATE%.log',
                        datePattern: 'YYYY-MM-DD-HH',
                        zippedArchive: true,
                        maxSize: '20m',
                        maxFiles: '14d',
                        json: false,
                        formatter: args => `${new Date().toISOString()} - ${args.level} - ${args.message}`,
                        dirname: 'logs',
                    }),
                ];

            if (process.env.SEND_LOGS && parseInt(process.env.SEND_LOGS, 10)) {
                transports.push(new (winston.transports.Loggly)({
                    inputToken: 'abfd90ee-ced9-49c9-be1a-850316aaa306',
                    subdomain: 'origintrail.loggly.com',
                    tags: [process.env.NODE_ENV, runtimeConfigJson.network.id, pjson.version],
                    json: true,
                }));
                transports.push(new winston.transports.Papertrail({
                    logFormat: (level, message) => `${new Date().toISOString()} - ${Logger.colorize(level)} - ${Logger.colorize(level, message)}`,
                    level: 'trace',
                    levels: {
                        trace: 7,
                        notify: 6,
                        debug: 5,
                        info: 4,
                        warn: 3,
                        important: 2,
                        error: 1,
                        api: 0,
                    },
                    host: 'logs4.papertrailapp.com',
                    port: 39178,
                    meta: '',
                }));
            }

            const logger = new (winston.Logger)({
                level: logLevel,
                levels: {
                    error: 0,
                    important: 1,
                    job: 2,
                    api: 3,
                    warn: 4,
                    notify: 5,
                    info: 6,
                    trace: 7,
                    debug: 8,
                },
                rewriters: [
                    () => null,
                ],
                transports,
            });

            // Extend logger object to properly log 'Error' types
            const origLog = logger.log;
            logger.log = (level, msg) => {
                if (msg instanceof Error) {
                    // eslint-disable-next-line prefer-rest-params
                    const args = Array.prototype.slice.call(arguments);
                    args[1] = msg.stack;
                    origLog.apply(logger, args);
                } else {
                    const transformed = Logger.transformLog(level, msg);
                    if (!transformed) {
                        return;
                    }
                    origLog.apply(logger, [transformed.level, transformed.msg]);
                }
            };
            return logger;
        } catch (e) {
            console.error('Failed to create logger', e);
            process.exit(1);
        }
    }

    /**
     * Colorize message based on its level
     * @param level - Logging level
     * @param message - Message
     * @return {*}
     */
    static colorize(level, message) {
        const customColors = {
            trace: 'grey',
            notify: 'green',
            debug: 'yellow',
            info: 'white',
            warn: 'yellow',
            important: 'magenta',
            error: 'red',
            api: 'cyan',
            job: 'cyan',
        };

        if (typeof message === 'undefined') {
            message = level;
        }

        let colorized = message;
        if (customColors[level] instanceof Array) {
            for (let i = 0, l = customColors[level].length; i < l; i += 1) {
                colorized = colors[customColors[level][i]](colorized);
            }
        } else if (customColors[level].match(/\s/)) {
            const colorArr = customColors[level].split(/\s+/);
            for (let i = 0; i < colorArr.length; i += 1) {
                colorized = colors[colorArr[i]](colorized);
            }
            customColors[level] = colorArr;
        } else {
            colorized = colors[customColors[level]](colorized);
        }
        return colorized;
    }

    /**
     * Skips/Transforms third-party logs
     * @return {*}
     */
    static transformLog(level, msg) {
        if (process.env.LOGS_LEVEL_DEBUG) {
            return {
                level,
                msg,
            };
        }
        if (msg.startsWith('connection timed out')) {
            return null;
        }
        if (msg.startsWith('negotiation error')) {
            return null;
        }
        if (msg.includes('received late or invalid response')) {
            return null;
        }
        if (msg.includes('error with remote connection')) {
            return null;
        }
        if (msg.includes('remote connection encountered error')) {
            return null;
        }
        if (msg.startsWith('updating peer profile')) {
            return null;
        }
        if (msg.includes('client cannot service request at this time')) {
            return null;
        }
        if (msg.includes('KADemlia error') && msg.includes('Message previously routed')) {
            return null;
        }
        if (msg.includes('gateway timeout')) {
            return null;
        }
        if (msg.startsWith('connect econnrefused')) {
            return null;
        }
        if (msg.includes('unable to route to tunnel')) {
            return null;
        }
        if (msg.includes('socket hang up')) {
            return null;
        }
        if (msg.includes('getaddrinfo')) {
            return null;
        }
        if (msg.includes('read econnreset')) {
            return null;
        }
        if (msg.includes('connect etimedout')) {
            return null;
        }
        if (msg.includes('connect ehostunreach')) {
            return null;
        }
        if (msg.includes('ssl23_get_server_hello')) {
            return null;
        }
        return {
            level,
            msg,
        };
    }
}

/**
 * Creates simple proxy to logger underneath
 * @returns {Logger}
 */
const proxy = () => new Proxy(new Logger(), {
    get(target, propKey) {
        return target.logger(propKey);
    },
});

module.exports = proxy;

