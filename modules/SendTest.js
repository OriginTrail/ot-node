const testTable = require('./test_table')();
const signing = require('./blockchain_interface/ethereum/signing.js')();
const axios = require('axios');
const utilities = require('./utilities')();
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
		}, 15000);
	}

	/**
	 * End the test sequence
	 *
	 */
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
			if(test.length === 0) return;
			log.info('All tests:');
			test = test[0];
			//log.info(test);
			let currentUnixTime = Math.floor(new Date() / 1000);

			if (currentUnixTime > test.test_time) {

				this.sendTest(test.dh_ip, test.dh_port, test.question, answer => {
					log.info('Test sent:');
					//log.info(test);
					this.verifyResult(test, answer.data);
				});

			} else {
				log.info('Test time: ' + test.test_time);
				log.info('Current time: ' + currentUnixTime);
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
	sendTest(ip, port, question, callback) {
		log.info('Entering sendTest');
		question = JSON.stringify({
			question: question
		});
		// log.info('Question to send');
		// log.info(question);
		let testQuestion = utilities.copyObject(question);
		delete testQuestion.answer;

		const options = {
			method: 'POST',
			url: 'http://' + ip + ':' + port + '/api/testing',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': question.length
			},
			data: question
		};

		axios(options).then(result => {
          utilities.executeCallback(callback, result);
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
		if(test.answer === answer) {
			log.info('Answer is good');
			this.sendReceipt().then(result => {
				log.info('Receipt sent. Result:');
				//log.info(result);
			});
			testTable.popNextTest(() => {
				log.info("Test deleted from database");
			});
		} else {
			log.warn('Answer not good');
		}
	}


	createReceipt() {
		//return signing.createConfirmation(DH_wallet, data_id, confirmation_verification_number, confirmation_time, confirmation_valid);
	}

	async sendReceipt(ip, port) {
		log.info('Sending receipt...');
		const receipt = this.createReceipt();
	//	log.info(receipt);
		const options = {
			method: 'POST',
			url: 'http://' + ip + ':' + port + '/api/receipt',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': receipt.length
			},
			data: receipt
		};

		let result = await axios(options);
		return result;
	}
}

(new SendTests).startTests();