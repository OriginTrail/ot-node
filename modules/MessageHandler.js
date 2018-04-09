var node = require('./Node');

class MessageHandler {
    connectToSeed(seed) {

    }

    sendBroadcast(channel, message) {
        node.ot.quasarPublish(channel, message);
    }

    onBroadcastMessage(channel) {
        return new Promise((resolve, reject) => {
            node.ot.quasarSubscribe(channel, (message, error) => {
                console.log("Error: " + error);
                console.log("channel: " + channel);
                console.log("message: " + message);
                if (error) {
                    reject(error);
                }
                resolve({ channel, message });
            });
        });
    }

    sendDirectMessage(contact, channel, msg) {
        return new Promise((resolve, reject) => {
            node.ot.send(channel, {
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
