const testTable = require('./test_table')();
const https = require('https');

class SendTests {

	/**
	 * Start the test sequence
	 *
	 */
	startTests() {
		return setInterval(() => {
			this.checkTests();
		}, 1000);
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
				var result = this.sendTest(test.dh_ip, test.dh_port, test.question);
				this.verifyResult(test, result.answer);

			} else {
				console.log(test);
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
	sendTest(ip, port, question) {
		question = JSON.stringify({
			question: question
		});


		const options = {
			hostname: ip,
			port: port,
			path: '/api/testing',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': question.length
			}
		};

		https.post( options, (resp) => {
			let data = '';

			// A chunk of data has been recieved.
			resp.on('data', (chunk) => {
				data += chunk;
			});

			// The whole response has been received. Print out the result.
			resp.on('end', () => {
				return data;
			});

		}).on('error', (err) => {
			console.log('Error: ' + err.message);
		});

	}

	/**
	 * Verify if the test result is correct and sends the receipt
	 *
	 * @param test
	 * @param answer
	 */
	verifyResult(test, answer) {
		if(test.answer === answer) {
			this.sendReceipt(); //TODO: Send receipt
			testTable.popNextTest(() => {

			});
		}
	}

	sendReceipt() {

	}
}

(new SendTests).startTests();