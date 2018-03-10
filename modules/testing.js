var utilities = require('./utilities')();
var config = utilities.getConfig();
const log = utilities.getLogger();
var test_table = require('./test_table')();
var encryption = require('./encryption')();
var graph = require('./graph')();
var async = require('async');

module.exports = function () {

	var testing = {
		generateTests: function(dh_ip, dh_port, dh_wallet, encrypted_vertices, number_of_tests, start_time, end_time, callback) {
			//log.info('[DH] Encrypted vertices:');
			//log.info(encrypted_vertices);
			var tests = [];

			for(let i = 0; i < number_of_tests; i++) {

				let new_test = {};

				let j = utilities.getRandomIntRange(0,encrypted_vertices.length - 1);
				//log.error('Random number: ' + j);
				let test_vertex = encrypted_vertices[j];
				let test_vertex_data = test_vertex.data;

				let start_index = 0;
				let end_index = 0;

				start_index = utilities.getRandomIntRange(0,test_vertex_data.length -1);
				end_index = utilities.getRandomIntRange(start_index, test_vertex_data.length -1);

				let question = {vertex_key: test_vertex._key, start_index: start_index, end_index: end_index};
				let answer = test_vertex_data.substring(start_index, end_index);

				new_test.question = question;
				new_test.answer = answer;
				new_test.dh_ip = dh_ip;
				new_test.dh_port = dh_port;
				new_test.dc_ip = config.NODE_IP;
				new_test.dc_port = config.NODE_PORT;
				new_test.dh_wallet = dh_wallet;

				if(i == number_of_tests - 1)
				{	
					new_test.test_time = end_time;
				} else {
					new_test.test_time = utilities.getRandomIntRange(start_time, end_time - 1);
				}

				tests.push(new_test);
			}

			test_table.insertTests(tests, function(response) {
				utilities.executeCallback(callback, response);
			});
		},

		answerQuestion: function(test, callback) {
			var question = test.question;
			let start_index = question.start_index;
			let end_index = question.end_index;
			let vertex_key = question.vertex_key;

			console.log('VERTEX_KEY',vertex_key);

			graph.getVertices({_key: vertex_key}, function(response) {

				let vertex = response[0];

				if(vertex == undefined || vertex.data == undefined)
				{
					utilities.executeCallback(callback, 'MISSING_DATA');
					return;
				}
				else
				{
					let vertex_data = vertex.data;

					console.log('-------')					
					console.log(start_index, end_index);
					console.log('-------')
					//console.log('VERTEX_DATA', vertex.data);
					console.log('-------')

					let answer = vertex_data.substring(start_index, end_index);

					utilities.executeCallback(callback, answer);
				}
			});

		}

	};

	return testing;

};