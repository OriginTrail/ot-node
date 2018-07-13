const sleep = require('sleep');

class TimeUtils {
    constructor() {
        this._sleepRoutine = sleep.msleep;
    }

    wait(milliseconds) {
        if (typeof milliseconds && !Number.isNaN(milliseconds)) {
            this._sleepRoutine(milliseconds);
        } else {
            throw Error('Expected a valid number in milliseconds.');
        }
    }
}

module.exports = TimeUtils;
