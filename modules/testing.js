const utilities = require('./utilities')();

const config = utilities.getConfig();
const log = utilities.getLogger();
const test_table = require('./test_table')();
const encryption = require('./encryption')();
const graph = require('./graph')();
const async = require('async');

module.exports = function () {
    const testing = {
        generateTests(data_id, dh_ip, dh_port, dh_wallet, encrypted_vertices, number_of_tests, start_time, end_time, callback) {
            // log.info('[DH] Encrypted vertices:');
            // log.info(encrypted_vertices);
            const tests = [];

            for (let i = 0; i < number_of_tests; i++) {
                const new_test = {};

                const j = utilities.getRandomIntRange(0, encrypted_vertices.length - 1);
                // log.error('Random number: ' + j);
                const test_vertex = encrypted_vertices[j];
                const test_vertex_data = test_vertex.data;

                let start_index = 0;
                let end_index = 0;

                start_index = utilities.getRandomIntRange(0, test_vertex_data.length - 1);
                end_index = utilities.getRandomIntRange(start_index, test_vertex_data.length - 1);

                const question = { vertex_key: test_vertex._key, start_index, end_index };
                const answer = test_vertex_data.substring(start_index, end_index);

                new_test.question = question;
                new_test.answer = answer;
                new_test.dh_ip = dh_ip;
                new_test.dh_port = dh_port;
                new_test.dc_ip = config.NODE_IP;
                new_test.dc_port = config.NODE_PORT;
                new_test.dh_wallet = dh_wallet;
                new_test.data_id = data_id;

                if (i == number_of_tests - 1) {
                    new_test.test_time = end_time;
                } else {
                    new_test.test_time = utilities.getRandomIntRange(start_time, end_time - 1);
                }

                tests.push(new_test);
            }

            test_table.insertTests(tests, (response) => {
                utilities.executeCallback(callback, response);
            });
        },

        answerQuestion(test, callback) {
            const question = test.question;
            const start_index = question.start_index;
            const end_index = question.end_index;
            const vertex_key = question.vertex_key;

            // console.log('VERTEX_KEY',vertex_key);

            graph.getVertices({ _key: vertex_key }, (response) => {
                const vertex = response[0];

                if (vertex == undefined || vertex.data == undefined) {
                    utilities.executeCallback(callback, 'MISSING_DATA');
                    return;
                }

                const vertex_data = vertex.data;

                const answer = vertex_data.substring(start_index, end_index);

                utilities.executeCallback(callback, answer);
            });
        },

    };

    return testing;
};
