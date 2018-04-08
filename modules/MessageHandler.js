var { node } = require('./Node');

class MessageHandler {
    connectToSeed(seed) {

    }

    sendBroadcast(channel, message) {
        node.quasarPublish(channel, message);
    }

    onBroadcastMessage(channel) {
        return new Promise((resolve, reject) => {
            node.quasarSubscribe(channel, (message, error) => {
                if (error) {
                    reject(error);
                }
                resolve(message);
            });
        });
    }

    sendDirectMessage(contact, channel, msg) {
        return new Promise((resolve, reject) => {
            node.send(channel, {
                message: msg,
            }, contact, (err, response) => {
                if (err) {
                    reject(err);
                }

                console.log('Response: ', response);
                resolve(response);
            });
        });
    }

    onDirectMessage(channel) {
        return new Promise((resolve, reject) => {
            node.use((request, response, next) => {
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
