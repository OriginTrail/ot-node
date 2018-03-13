// External modules
const io = require('socket.io')();
const utilities = require('./utilities')();

const log = utilities.getLogger();
const EventHandlers = require('./EventHandlers');

// Socket communication settings
// io.set('origins', 'localhost:*');

io.on('connection', (socket) => {
    log.info('RPC Server connected');

    socket.on('event', (data) => {
        new EventHandlers(data, socket);
    });
});

module.exports = function () {
    const sockets = {

        start() {
            io.listen(3000);
            log.info(`IPC-RPC Communication server listening on port ${3000}`);
        },

    };

    return sockets;
};
