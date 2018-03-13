// External modules
const unirest = require('unirest');
const kademlia = require('./kademlia')();
const utilities = require('./utilities')();

const config = utilities.getConfig();
const log = utilities.getLogger();

module.exports = function () {
    const replication = {

        replicate(input_file) {
            kademlia.clearPingResponses();
            kademlia.waitForResponse();

            const reqNum = utilities.getRandomInt(10000000000);

            kademlia.sendRequest('ot-ping-request', {
                request_id: reqNum,
                sender_ip: config.NODE_IP,
                sender_port: config.RPC_API_PORT,
            });

            setTimeout(() => {
                kademlia.stopWaitingForResponse();

                const responses = kademlia.getPingResponses();

                for (const i in responses) {
                    unirest.post(`http://${responses[i].sender_ip}:${responses[i].sender_port}/import`)
                        .headers({
                            'Content-Type': 'multipart/form-data',
                        })
                        .field('noreplicate', true)
                        .attach('importfile', input_file)
                        .end((response) => {
                            log.info(`Replication response : ${JSON.stringify(response.body)}`);
                        });
                }
            }, parseInt(config.REQUEST_TIMEOUT));
        },

    };

    return replication;
};
