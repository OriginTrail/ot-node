const async = require('async');
const { setTimeout: sleep } = require('timers/promises');
const { forEach } = require('p-iteration');

const Command = require('./command');
const constants = require('../constants/constants');

/**
 * Command statuses
 * @type {{failed: string, expired: string, started: string, pending: string, completed: string}}
 */
const STATUS = {
    failed: 'FAILED',
    expired: 'EXPIRED',
    started: 'STARTED',
    pending: 'PENDING',
    completed: 'COMPLETED',
    repeating: 'REPEATING',
};

/**
 * How many commands will run in parallel
 * @type {number}
 */
const QUEUE_PARALLELISM = 4;

/**
 * Queues and processes commands
 */
class CommandExecutor {
    constructor(ctx) {
        this.ctx = ctx;
        this.logger = ctx.logger;
        this.commandResolver = ctx.commandResolver;
        this.config = ctx.config;
        this.started = false;

        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.parallelism = QUEUE_PARALLELISM;
        this.verboseLoggingEnabled = this.config.commandExecutorVerboseLoggingEnabled;

        const that = this;
        this.queue = async.queue(async (command, callback) => {
            try {
                while (!that.started) {
                    if (that.verboseLoggingEnabled) {
                        that.logger.trace(
                            'Command executor has not been started yet. Hibernating...',
                        );
                    }

                    // eslint-disable-next-line no-await-in-loop
                    await sleep(1000);
                }
            } catch (e) {
                this.logger.error({
                    msg: `Something went really wrong! OT-node shutting down... ${e}`,
                    Event_name: constants.ERROR_TYPE.COMMAND_EXECUTOR_ERROR,
                });
                process.exit(1);
            }

            callback();
        }, this.parallelism);
    }

    /**
     * Initialize executor
     * @returns {Promise<void>}
     */
    async init() {
        await forEach(constants.PERMANENT_COMMANDS, async (command) =>
            this._startDefaultCommand(command),
        );
        if (this.verboseLoggingEnabled) {
            this.logger.trace('Command executor has been initialized...');
        }
    }

    /**
     * Starts the command executor
     * @return {Promise<void>}
     */
    async start() {
        this.started = true;
        if (this.verboseLoggingEnabled) {
            this.logger.trace('Command executor has been started...');
        }
    }

    /**
     * Executes commands
     * @param command Command
     */
    async _execute(executeCommand) {
        const command = executeCommand;
        const now = new Date().getTime() / 1000;
        await this._update(command, {
            started_at: now,
        });

        if (this.verboseLoggingEnabled) {
            this.logger.trace(`Command ${command.name} and ID ${command.id} started.`);
        }

        const handler = this.commandResolver.resolve(command.name);
        if (command.deadline_at && now > command.deadline_at) {
            this.logger.warn(`Command ${command.name} and ID ${command.id} is too late...`);
            await this._update(command, {
                status: STATUS.expired,
            });
            try {
                const result = await handler.expired(command);
                if (result && result.commands) {
                    result.commands.forEach((c) => this.add(c, c.delay, true));
                }
            } catch (e) {
                this.logger.warn(
                    `Failed to handle expired callback for command ${command.name} and ID ${command.id}`,
                );
            }
            return;
        }

        const waitMs = command.ready_at + command.delay - now;
        if (waitMs > 0) {
            if (this.verboseLoggingEnabled) {
                this.logger.trace(
                    `Command ${command.name} with ID ${command.id} should be delayed`,
                );
            }
            await this.add(command, Math.min(waitMs, constants.MAX_COMMAND_DELAY_IN_MILLS), false);
            return;
        }

        try {
            const processResult = await this._process(async (transaction) => {
                await this._update(
                    command,
                    {
                        status: STATUS.started,
                    },
                    transaction,
                );

                command.data = handler.unpack(command.data);
                let result = await handler.execute(command, transaction);
                if (result.repeat) {
                    await this._update(
                        command,
                        {
                            status: STATUS.repeating,
                        },
                        transaction,
                    );

                    command.data = handler.pack(command.data);

                    const period = command.period
                        ? command.period
                        : constants.DEFAULT_COMMAND_REPEAT_INTERVAL_IN_MILLS;
                    await this.add(command, period, false);
                    return Command.repeat();
                }

                if (result.retry) {
                    result = await this._handleRetry(command, handler);
                    if (result.retry) {
                        return result;
                    }
                }

                const children = result.commands.map((c) => {
                    const newCommand = c;
                    newCommand.parent_id = command.id;
                    return newCommand;
                });

                await Promise.all(children.map((e) => this._insert(e, transaction)));
                await this._update(
                    command,
                    {
                        status: STATUS.completed,
                    },
                    transaction,
                );
                return {
                    children,
                };
            }, command.transactional);

            if (!processResult.repeat && !processResult.retry) {
                if (this.verboseLoggingEnabled) {
                    this.logger.trace(`Command ${command.name} and ID ${command.id} processed.`);
                }
                const addPromises = [];
                processResult.children.forEach((e) =>
                    addPromises.push(this.add(e, e.delay, false)),
                );
                await Promise.all(addPromises);
            }
        } catch (e) {
            if (this.verboseLoggingEnabled) {
                this.logger.trace(
                    `Failed to process command ${command.name} and ID ${command.id}. ${e}.\n${e.stack}`,
                );
            }

            try {
                const result = await this._handleError(command, handler, e);
                if (result && result.commands) {
                    result.commands.forEach((c) => this.add(c, c.delay, true));
                }
            } catch (error) {
                this.logger.warn(
                    `Failed to handle error callback for command ${command.name} and ID ${command.id}, error: ${error.message}`,
                );
            }
        }
    }

    /**
     * Process command using transaction or not
     * @param execFn
     * @param transactional
     * @returns {Promise<*>}
     * @private
     */
    async _process(execFn, transactional) {
        if (transactional) {
            return this.repositoryModuleManager.transaction(execFn);
        }
        return execFn(null);
    }

    /**
     * Starts the default command by name
     * @param name - Command name
     * @return {Promise<void>}
     * @private
     */
    async _startDefaultCommand(name) {
        await this._delete(name);
        const handler = this.commandResolver.resolve(name);
        await this.add(handler.default(), constants.DEFAULT_COMMAND_DELAY_IN_MILLS, true);
        if (this.verboseLoggingEnabled) {
            this.logger.trace(`Permanent command ${name} created.`);
        }
    }

    /**
     * Adds single command to queue
     * @param command
     * @param delay
     * @param insert
     */
    async add(addCommand, addDelay = 0, insert = true) {
        let command = addCommand;
        let delay = addDelay;
        const now = new Date().getTime() / 1000;

        if (delay != null && delay > constants.MAX_COMMAND_DELAY_IN_MILLS) {
            if (command.ready_at == null) {
                command.ready_at = now;
            }
            command.ready_at += delay;
            delay = constants.MAX_COMMAND_DELAY_IN_MILLS;
        }

        if (insert) {
            command = await this._insert(command);
        }
        if (delay) {
            setTimeout(
                (timeoutCommand) => {
                    this.queue.push(timeoutCommand);
                },
                delay,
                command,
            );
        } else {
            this.queue.push(command);
        }
    }

    /**
     * Handles command retry
     * @param command
     * @param handler
     * @private
     */
    async _handleRetry(retryCommand, handler) {
        const command = retryCommand;
        if (command.retries > 1) {
            command.data = handler.pack(command.data);
            await this._update(command, {
                status: STATUS.pending,
                retries: command.retries - 1,
            });
            const period = command.period ? command.period : 0;
            const delay = command.delay ? command.delay : 0;
            await this.add(command, period + delay, false);
            return Command.retry();
        }
        await handler.retryFinished(command);
        return Command.empty();
    }

    /**
     * Handles command error
     * @param command
     * @param handler
     * @param err
     * @return {Promise<void>}
     * @private
     */
    async _handleError(command, handler, err) {
        if (command.retries > 0) {
            await this._update(command, {
                retries: command.retries - 1,
            });
            await this.add(command, command.delay ? command.delay : 0, false);
        } else {
            try {
                await this._update(command, {
                    status: STATUS.failed,
                    message: err.message,
                });
                this.logger.warn(`Error in command: ${command.name}, error: ${err.message}`);
                return await handler.recover(command, err);
            } catch (e) {
                this.logger.warn(`Failed to recover command ${command.name} and ID ${command.id}`);
            }
        }
    }

    /**
     * Inserts command in the db
     * @param command
     * @param transaction
     * @return {Promise<void>}
     * @private
     */
    async _insert(insertCommand, transaction = null) {
        const command = insertCommand;
        if (!command.name) {
            [command.name] = command.sequence;
            command.sequence = command.sequence.slice(1);
        }
        if (!command.ready_at) {
            command.ready_at = new Date().getTime() / 1000; // take current time
        }
        if (command.delay == null) {
            command.delay = 0;
        }
        if (!command.transactional) {
            command.transactional = 0;
        }
        if (!command.data) {
            const commandInstance = this.commandResolver.resolve(command.name);
            command.data = commandInstance.pack(command.data);
        }
        command.status = STATUS.pending;
        const opts = {};
        if (transaction != null) {
            opts.transaction = transaction;
        }
        const model = await this.repositoryModuleManager.createCommand(command, opts);
        command.id = model.dataValues.id;
        return command;
    }

    /**
     * Delete command from database
     * @param name
     * @returns {Promise<void>}
     * @private
     */
    async _delete(name) {
        await this.repositoryModuleManager.destroyCommand(name);
    }

    /**
     * Updates command in the db
     * @param command
     * @param update
     * @param transaction
     * @return {Promise<void>}
     * @private
     */
    async _update(command, update, transaction = null) {
        Object.assign(command, update);
        const opts = {
            returning: true,
            where: {
                id: command.id,
            },
        };
        if (transaction) {
            opts.transaction = transaction;
        }
        await this.repositoryModuleManager.updateCommand(update, opts);
    }

    /**
     * Replays pending commands from the database
     * @returns {Promise<void>}
     */
    async replay() {
        // Wait for 1 minute for node to establish connections
        // await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));

        this.logger.info('Replay pending/started commands from the database...');
        const pendingCommands = (
            await this.repositoryModuleManager.getCommandsWithStatus(
                [STATUS.pending, STATUS.started, STATUS.repeating],
                ['cleanerCommand', 'autoupdaterCommand'],
            )
        ).filter((command) => !constants.PERMANENT_COMMANDS.includes(command.name));

        // TODO consider JOIN instead
        const commands = pendingCommands.filter(async (pc) => {
            if (!pc.parent_id) {
                return true;
            }
            const parent = await this.repositoryModuleManager.getCommandWithId(pc.parent_id);
            return !parent || parent.status === 'COMPLETED';
        });

        const adds = [];
        for (const commandModel of commands) {
            const command = {
                id: commandModel.id,
                name: commandModel.name,
                data: commandModel.data,
                ready_at: commandModel.ready_at,
                delay: commandModel.delay,
                started_at: commandModel.started_at,
                deadline_at: commandModel.deadline_at,
                period: commandModel.period,
                status: commandModel.status,
                message: commandModel.message,
                parent_id: commandModel.parent_id,
                transactional: commandModel.transactional,
                retries: commandModel.retries,
                sequence: commandModel.sequence,
            };
            const queued = this.queue.workersList().find((e) => e.data.id === command.id);
            if (!queued) {
                adds.push(this.add(command, 0, false, true));
            }
        }
        await Promise.all(adds);
    }
}

module.exports = CommandExecutor;
