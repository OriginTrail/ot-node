/**
 * Represent one ignored network request.
 */
class NetworkRequestIgnoredError extends Error {
    constructor(message, request) {
        super(message);

        // Ensure the name of this error is the same as the class name
        this.name = this.constructor.name;

        this.request = request;

        // This clips the constructor invocation from the stack trace.
        Error.captureStackTrace(this, this.constructor);
    }
}
