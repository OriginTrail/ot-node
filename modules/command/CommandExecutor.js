const async = require('async');
const Models = require('../../models');

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

        this.parallelism = QUEUE_PARALLELISM;
        this.queue = async.queue(async (command, callback) => {
            await this._execute(command);
            callback();
        }, this.parallelism);
    }

    /**
     * Executes commands
     * @param command Command
     */
    async _execute(command) {
        const now = Date.now();
        await CommandExecutor._update(command, {
            started_at: now,
        });

        const handler = this.resolve(command);
        if (command.deadline_at && now > command.deadline_at) {
            this.logger.warn(`Command ${command.name} and ID ${command.id} is too late...`);
            await CommandExecutor._update(command, {
                status: STATUS.expired,
            });
            try {
                await handler.expired(command);
            } catch (e) {
                this.logger.warn(`Failed to handle expired callback for command ${command.name} and ID ${command.id}`);
            }
            return;
        }

        const waitMs = (command.ready_at + command.delay) - now;
        if (waitMs > 0) {
            this.logger.trace(`Command ${command.name} with ID ${command.id} should be delayed`);
            await this.add(command, waitMs, false);
            return;
        }

        try {
            const result = await this._process(async (transaction) => {
                await CommandExecutor._update(command, {
                    status: STATUS.started,
                }, transaction);

                const result = await handler.execute(command, transaction);
                if (result.repeat) {
                    await CommandExecutor._update(command, {
                        status: STATUS.pending,
                        duration: Date.now() - command.started_at,
                    }, transaction);
                    await this.add(command, command.period, false);
                    return {
                        repeat: true,
                        command: [],
                    };
                }

                let children = result.commands;
                await CommandExecutor._update(command, {
                    status: STATUS.completed,
                    duration: Date.now() - command.started_at,
                }, transaction);

                children = children.map((c) => {
                    c.parent_id = command.id;
                    return c;
                });

                await Promise.all(children.map(e => CommandExecutor._insert(e, transaction)));
                return {
                    children,
                };
            }, command.transactional);

            if (!result.repeat) {
                this.logger.trace(`Command ${command.name} and ID ${command.id} processed.`);
                result.children.forEach(async e => this.add(e, e.delay, false));
            }
        } catch (e) {
            console.log(e);
            this.logger.error(`Failed to process command ${command.name} and ID ${command.id}. ${e}`);
            try {
                await this._handleError(command, handler, e);
            } catch (e) {
                this.logger.warn(`Failed to handle error callback for command ${command.name} and ID ${command.id}`);
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
            return Models.sequelize.transaction(async t => execFn(t));
        }
        return execFn(null);
    }

    /**
     * Adds single command to queue
     * @param command
     * @param delay
     * @param insert
     */
    async add(command, delay = 0, insert = true) {
        if (insert) {
            command = await CommandExecutor._insert(command);
        }
        if (delay) {
            setTimeout(command => this.queue.push(command), delay, command);
        } else {
            this.queue.push(command);
        }
    }

    /**
     * Gets command handler based on command name
     * @param command
     * @return {*}
     */
    resolve(command) {
        try {
            return this.ctx[`${command.name}Command`];
        } catch (e) {
            throw new Error(`No handler defined for command '${command.name}'`);
        }
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
            await CommandExecutor._update(command, {
                retries: command.retries - 1,
            });
            await this.add(command, command.delay, false);
        } else {
            try {
                await CommandExecutor._update(command, {
                    status: STATUS.failed,
                    message: err.message,
                });
                await handler.recover(command, err);
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
    static async _insert(command, transaction) {
        if (!command.name) {
            [command.name] = command.sequence;
            command.sequence = command.sequence.slice(1);
        }
        if (!command.ready_at) {
            command.ready_at = Date.now();
        }
        if (!command.delay) {
            command.delay = 0;
        }
        if (!command.transactional) {
            command.transactional = 0;
        }
        command.status = STATUS.pending;
        const opts = {
        };
        if (transaction != null) {
            opts.transaction = transaction;
        }
        const model = await Models.commands.create(command, opts);
        command.id = model.dataValues.id;
        return command;
    }

    /**
     * Updates command in the db
     * @param command
     * @param update
     * @param transaction
     * @return {Promise<void>}
     * @private
     */
    static async _update(command, update, transaction) {
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
        await Models.commands.update(
            update,
            opts,
        );
    }
}
module.exports = CommandExecutor;
