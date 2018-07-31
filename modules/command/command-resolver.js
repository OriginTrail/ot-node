class CommandResolver {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Gets command handler based on command name
     * @param name
     * @return {*}
     */
    resolve(name) {
        try {
            return this.ctx[`${name}Command`];
        } catch (e) {
            throw new Error(`No handler defined for command '${name}'`);
        }
    }
}

module.exports = CommandResolver;
