// External modules
const io = require('socket.io')();
const EventHandlers = require('./EventHandlers');

// Socket communication settings
// io.set('origins', 'localhost:*');

io.on('connection', function (socket) {
	console.log('RPC Server connected');

	socket.on('event', function (data) {
		new EventHandlers(data, socket);
	});
});

module.exports = function () {
	var sockets = {

		start: function () {
			io.listen(3000);
			console.log('IPC-RPC Communication server listening on port ' + 3000);
		}

	};

	return sockets;
};
