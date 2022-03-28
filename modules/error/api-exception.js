class ApplicationException {
    constructor(error, details) {
        this.error = error;
        this.details = [].concat(details);
    }

    status(status) {
        this.status = status;
    }

    getExceptionForLogging() {
        return `${this.status} - ${this.error}: ${JSON.stringify(this.details)}`;
    }
}

module.exports = ApplicationException;
