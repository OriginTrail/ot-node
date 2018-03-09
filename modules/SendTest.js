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
		return setInterval(() => {
			this.checkTests();
		}, 5000);
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
		testTable.getTests((test) => {
			if(test.length === 0) return;

			let currentUnixTime = Math.floor(new Date() / 1000);


			if (currentUnixTime > test.test_time) {
				this.sendTest(test.dh_ip, test.dh_port, test.question).then( result => {
					this.verifyResult(test, result.answer);
				}).catch(e => {
					log.info(e);
				});

			} else {
				//log.info(test);
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
	async sendTest(ip, port, question) {
		question = JSON.stringify({
			question: question
		});


		const options = {
			method: 'POST',
			url: 'http://' + ip + ':' + port + '/api/testing',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': question.length
			},
			data: question
		};

		let response = await axios(options);
		return response;
	}

	/**
	 * Verify if the test result is correct and sends the receipt
	 *
	 * @param test
	 * @param answer
	 */
	verifyResult(test, answer) {
		if(test.answer === answer) {
			this.sendReceipt();
			testTable.popNextTest(() => {

			});
		}
	}

	createReceipt() {
		return signing.createConfirmation(DH_wallet, data_id, confirmation_verification_number, confirmation_time, confirmation_valid);
	}

	async sendReceipt(ip, port) {
		const receipt = this.createReceipt();
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