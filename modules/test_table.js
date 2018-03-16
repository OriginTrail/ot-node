const utilities = require('./utilities');

const log = utilities.getLogger();
const storage = require('./storage')();

module.exports = function () {
    const test_table = {

        insertTest(test, callback) {
            storage.getObject('Tests', (response) => {
                const n = response.length;
                let i = n - 1;

                while (i >= 0 && response[i].test_time > test.test_time) {
                    // eslint-disable-next-line no-plusplus
                    i--;
                }

                response.splice(i + 1, 0, test);

                storage.storeObject('Tests', response, (status) => {
                    log.info(response);
                    utilities.executeCallback(callback, true);
                });
            });
        },

        insertTests(tests, callback) {
            storage.getObject('Tests', (response) => {
                // eslint-disable-next-line no-plusplus
                for (let j = 0; j < tests.length; j++) {
                    const n = response.length;
                    let i = n - 1;
                    while (i >= 0 && response[i].test_time > tests[j].test_time) {
                        // eslint-disable-next-line no-plusplus
                        i--;
                    }
                    response.splice(i + 1, 0, tests[j]);
                }

                storage.storeObject('Tests', response, (status) => {
                    utilities.executeCallback(callback, true);
                });
            });
        },

        popNextTest(callback) {
            storage.getObject('Tests', (response) => {
                if (response.length === 0) {
                    utilities.executeCallback(callback, undefined);
                } else {
                    const test = response.shift();

                    storage.storeObject('Tests', response, (status) => {
                        if (status === false) {
                            log.info('Storing tests failes!');
                            utilities.executeCallback(callback, {});
                        } else {
                            utilities.executeCallback(callback, test);
                        }
                    });
                }
            });
        },

        nextTest(callback) {
            storage.getObject('Tests', (response) => {
                if (response.length === 0) {
                    utilities.executeCallback(callback, {});
                } else {
                    const test = response[0];

                    utilities.executeCallback(callback, test);
                }
            });
        },

        getTests(callback) {
            storage.getObject('Tests', (response) => {
                // log.info(response);
                if (response.length === 0) {
                    log.info('There are no planed tests');
                    utilities.executeCallback(callback, []);
                } else {
                    utilities.executeCallback(callback, response);
                }
            });
        },
    };

    return test_table;
};
