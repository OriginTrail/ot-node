/**
 * Represent one failed transaction on a blockchain. Should be used
 * after a number of failed attempts.
 */
class TransactionFailedError extends Error {
    constructor(message, transaction) {
        super(message);

        // Ensure the name of this error is the same as the class name
        this.name = this.constructor.name;

        this.transaction = transaction;

        // This clips the constructor invocation from the stack trace.
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = TransactionFailedError;
