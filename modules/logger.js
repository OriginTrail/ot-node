const winston = require('winston');
require('winston-daily-rotate-file');
// eslint-disable-next-line
require('winston-papertrail').Papertrail;
require('winston-loggly-bulk');
const runtimeConfigJson = require('../config/config.json')[process.env.NODE_ENV];

const colors = require('colors/safe');
const pjson = require('../package.json');

const DEFAULT_LOGGLY_SUBDOMAIN = 'origintrail.loggly.com';
const DEFAULT_LOGGLY_INPUT_TOKEN = 'abfd90ee-ced9-49c9-be1a-850316aaa306';

const DEFAULT_PAPERTRAIL_PORT = 39178;
const DEFAULT_PAPERTRAIL_HOST = 'logs4.papertrailapp.com';

const DEFAULT_LOG_LEVEL = 'trace';

class Logger {
    constructor() {
        this._logger = Logger._create();
    }

    /**
     * Create logger
     * @return {Logger|*}
     * @private
     */
    static _create() {
        let logLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : DEFAULT_LOG_LEVEL;
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
                const logglySubdomain = process.env.LOGGLY_SUBDOMAIN ?
                    process.env.LOGGLY_SUBDOMAIN : DEFAULT_LOGGLY_SUBDOMAIN;
                const logglyInputToken = process.env.LOGGLY_INPUT_TOKEN ?
                    process.env.LOGGLY_INPUT_TOKEN : DEFAULT_LOGGLY_INPUT_TOKEN;

                // enable Loggly
                transports.push(new (winston.transports.Loggly)({
                    inputToken: logglyInputToken,
                    subdomain: logglySubdomain,
                    tags: [process.env.NODE_ENV, runtimeConfigJson.network.id, pjson.version],
                    json: true,
                }));

                const papertrailHost = process.env.PAPERTRAIL_HOST ?
                    process.env.PAPERTRAIL_HOST : DEFAULT_PAPERTRAIL_HOST;
                const papertrailPort = process.env.PAPERTRAIL_PORT ?
                    process.env.PAPERTRAIL_PORT : DEFAULT_PAPERTRAIL_PORT;

                // enable Papertrail
                transports.push(new winston.transports.Papertrail({
                    logFormat: (level, message) => `${new Date().toISOString()} - ${Logger.colorize(level)} - ${Logger.colorize(level, message)}`,
                    level: logLevel,
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
                    host: papertrailHost,
                    port: papertrailPort,
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
                    () => null, // disable metadata, we don't use it
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
        return target._logger[propKey];
    },
});

const LOGGER_INSTANCE = proxy();

// ensure the API is never changed
Object.freeze(LOGGER_INSTANCE);

// create a unique, global symbol name
// -----------------------------------
const LOGGER_KEY = Symbol.for('origintrail.otnode.logger');

// check if the global object has this symbol
// add it if it does not have the symbol, yet
// ------------------------------------------

const globalSymbols = Object.getOwnPropertySymbols(global);
const hasLogger = (globalSymbols.indexOf(LOGGER_KEY) > -1);

if (!hasLogger) {
    global[LOGGER_KEY] = LOGGER_INSTANCE;
}

module.exports = global[LOGGER_KEY];

