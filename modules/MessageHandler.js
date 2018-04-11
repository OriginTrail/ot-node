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

    sendDirectMessage(key, channel, msg) {
        return new Promise((resolve, reject) => {
            node.ot.send(
                channel, {
                    message: msg,
                }, ['28f2b296464d78dd510e4195e7627d934540e425', {
                    hostname: '192.168.100.144',
                    protocol: 'https:',
                    port: 5278,
                }]
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

    onDirectMessage(channel) {
        return new Promise((resolve, reject) => {
            node.ot.use((request, response, next) => {
                if (request.method === channel) {
                    console.log(JSON.stringify(request));
                    // response.send(request.params);
                    resolve({
                        request,
                        response,
                    });
                }
                next();
            });
        });
    }
}

module.exports = new MessageHandler();
