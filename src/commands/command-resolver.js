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
    resolve(name) {
        try {
            return this.ctx[`${name}`];
        } catch (e) {
            this.logger.warn(`No handler defined for command '${name}'`);
        }
    }
}

export default CommandResolver;
