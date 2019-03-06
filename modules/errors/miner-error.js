/**
 * Represents error that occurred during dataset import.
 */
class MinerError extends Error {
    constructor(message, offerId) {
        super(message);

        // Ensure the name of this error is the same as the class name
        this.name = this.constructor.name;

        this.offerId = offerId;

        // This clips the constructor invocation from the stack trace.
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = MinerError;
