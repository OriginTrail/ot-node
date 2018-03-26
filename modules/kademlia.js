// External modules
const leveldup = require('levelup');
const leveldown = require('leveldown');
const kad = require('kad');
const quasar = require('kad-quasar');
const utilities = require('./utilities');

const log = utilities.getLogger();
const config = utilities.getConfig();

// Response pool
let ping_responses = [];
let waiting_for_responses = false;
let node = null;

module.exports = () => {
    const kademlia = {

        sendRequest(requestType, requestObject) {
            node.quasarPublish(requestType, requestObject);
        },

        getPingResponses() {
            return ping_responses;
        },

        clearPingResponses() {
            ping_responses = [];
        },

        waitForResponse() {
            waiting_for_responses = true;
        },

        stopWaitingForResponse() {
            waiting_for_responses = false;
        },

        start() {
            const seed = ['0000000000000000000000000000000000000001', {
                hostname: config.KADEMLIA_SEED_IP,
                port: config.KADEMLIA_SEED_PORT,
            }];

            node = kad({
                transport: new kad.HTTPTransport(),
                // eslint-disable-next-line global-require
                storage: require('levelup')(leveldown('kad-storage')),
                contact: {
                    hostname: config.NODE_IP,
                    port: config.KADEMLIA_PORT,
                },
            });

            node.plugin(quasar);

            if (config.IS_KADEMLIA_BEACON === 'false') {
                node.join(seed, () => {
                    if (node.router.size !== 0) {
                        log.info('Kademlia connected to seed');
                    } else {
                        log.warn('Kademlia connection to seed failed');
                    }
                });
            }

            node.listen(config.KADEMLIA_PORT, () => {
                log.info('Kademlia service listening...');
            });

            node.quasarSubscribe('ot-ping-request', (content) => {
                if (content.sender_ip === config.NODE_IP &&
                    content.sender_port === config.RPC_API_PORT) {
                    return;
                }

                node.quasarPublish('ot-ping-response', {
                    request_id: content.request_id,
                    sender_ip: config.NODE_IP,
                    sender_port: config.RPC_API_PORT,
                    message: 'ALOHA',
                });
            });

            node.quasarSubscribe('ot-ping-response', (content) => {
                if (content.sender_ip === config.NODE_IP &&
                    content.sender_port === config.RPC_API_PORT) {
                    return;
                }

                if (waiting_for_responses === true) {
                    ping_responses.push(content);
                }
            });
        },
    };

    return kademlia;
};
