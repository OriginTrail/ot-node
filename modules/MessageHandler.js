var node = require('./Node');
const config = require('./Config');


class MessageHandler {


    connectToSeed(seed) {

    }

    sendBroadcast(channel, message) {
        node.ot.quasarPublish(channel, message);
    }

    onBroadcastMessage(channel) {
        return new Promise((resolve) => {
            node.ot.quasarSubscribe(channel, (message, error) => {
                resolve(message);
            });
        });
    }

    sendDirectMessage(contact, channel, msg) {
        return new Promise((resolve, reject) => {
            node.ot.send(
                channel, {
                    message: msg,
                }, [], contact
                , (err, response) => {
                    if (err) {
                        reject(err);
                    }

                    console.log('Response: ', response);
                    resolve(response);
                },
            );
        });
    }
}

module.exports = new MessageHandler();
