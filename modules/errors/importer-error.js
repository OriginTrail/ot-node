/**
 * Represents error that occurred during dataset import.
 */
class ImporterError extends Error {
    constructor(message) {
        super(message);

        // Ensure the name of this error is the same as the class name
        this.name = this.constructor.name;

        // This clips the constructor invocation from the stack trace.
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ImporterError;
