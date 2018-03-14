const testTable = require('./test_table')();
const signing = require('./blockchain_interface/ethereum/signing.js')();
const axios = require('axios');
const holding = require('./holding')();
const utilities = require('./utilities')();

const config = utilities.getConfig();
const log = utilities.getLogger();

class SendTests {
    /**
    * Start the test sequence
    *
    */
    startTests() {
        log.info('Starting tests');
        return setInterval(() => {
            this.checkTests();
        }, 45000);
    }

    /**
    * End the test sequence
    *
    */
    // eslint-disable-next-line class-methods-use-this
    endTests(test) {
        clearInterval(test);
    }
    /**
    * Check if there is a new test to be sent
    *
    */
    checkTests() {
        log.info('Checking if there are tests to send');
        testTable.getTests((test) => {
            if (test.length === 0) return;
            // eslint-disable-next-line prefer-destructuring
            test = test[0]; // eslint-disable-line no-param-reassign
            const currentUnixTime = Math.floor(new Date() / 1000);

            if (currentUnixTime > test.test_time) {
                this.sendTest(test.dh_ip, test.dh_port, test.question, (answer) => {
                    log.info('Test sent:');
                    // log.info(test);
                    this.verifyResult(test, answer.data);
                });
            } else {
                log.info(`Next test time: ${test.test_time}`);
                log.info(`Current time: ${currentUnixTime}`);
            }
        });
    }

    /**
    * Sends test to Data Holder
    *
    * @param ip string DH IP address
    * @param port string DH port
    * @param question object
    * @returns {Promise.data} object data.answer
    */
    // eslint-disable-next-line class-methods-use-this
    sendTest(ip, port, question, callback) {
        log.info('Entering sendTest');
        // eslint-disable-next-line no-param-reassign
        question = JSON.stringify({
            question,
        });
        // log.info('Question to send');
        // log.info(question);
        const testQuestion = utilities.copyObject(question);
        delete testQuestion.answer;

        const options = {
            method: 'POST',
            url: `http://${ip}:${port}/api/testing`,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': question.length,
            },
            data: question,
        };

        axios(options).then((result) => {
            utilities.executeCallback(callback, result);
        }).catch((err) => {
            console.error(err);
        });
    }

    /**
    * Verify if the test result is correct and sends the receipt
    *
    * @param test
    * @param answer
    */
    verifyResult(test, answer) {
        log.info('Entering verifyResult');
        // log.error(test.answer);
        // log.warn(answer);
        let receipt;
        if (test.answer === answer.answer) {
            log.info('Answer is good');
            holding.getHoldingData(config.DH_WALLET, test.data_id, (holdingData) => {
                // eslint-disable-next-line max-len
                receipt = signing.createConfirmation(config.DH_WALLET, test.data_id, holdingData.confirmation_number, test.test_time, true);
                this.sendReceipt(answer.ip, answer.port, receipt).then((result) => {
                    log.info('Receipt sent. Result:');
                    testTable.popNextTest(() => {
                        log.info('Test deleted from database');
                    });
                }).catch((err) => {
                    console.error('DH connection failed');
                });
            });
        } else {
            log.warn('Answer not good');

            holding.getHoldingData(answer.wallet, test.data_id, (holdingData) => {
                // eslint-disable-next-line max-len
                receipt = signing.createConfirmation(answer.wallet, test.data_id, holdingData.confirmation_number, test.test_time, false);
                // eslint-disable-next-line max-len
                holding.increaseConfirmationVerificationNumber(answer.wallet, test.data_id, (response) => {
                    this.sendReceipt(answer.ip, answer.port, receipt).then((result) => {
                        log.info('Receipt sent. Result:');
                        testTable.popNextTest(() => {
                            log.info('Test deleted from database');
                        });
                    }).catch((err) => {
                        console.error(err);
                    });
                });
            });
        }
    }

    // eslint-disable-next-line class-methods-use-this
    async sendReceipt(ip, port, receipt) {
        log.info('Sending receipt...');

        // log.info(receipt);
        const options = {
            method: 'POST',
            url: `http://${ip}:${port}/api/receipt`,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': receipt.length,
            },
            data: receipt,
        };

        const result = await axios(options);
        return result;
    }
}

(new SendTests()).startTests();
