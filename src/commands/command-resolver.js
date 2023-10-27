/**
 * Resolves command handlers based on command names
 */
class CommandResolver {
    constructor(ctx) {
        this.ctx = ctx;
        this.logger = ctx.logger;
    }

    /**
     * Gets command handler based on command name
     * @param name
     * @return {*}
     */
    resolve(commandName) {
        const handler = this.ctx[`${commandName}`];
        if (handler === undefined) {
            this.logger.warn(`No handler defined for the ${commandName}.`);
        }
        return handler;
    }
}

export default CommandResolver;
