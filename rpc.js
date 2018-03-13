// External modules and dependencies
var restify = require('restify');
var utilities = require('./modules/utilities')();
var kademlia = require('./modules/kademlia')();
var replication = require('./modules/replication')();
var io = require('socket.io-client')('http://localhost:3000');
var config = utilities.getConfig();
var natUpnp = require('nat-upnp');
const log = utilities.getLogger();
// Active requests pool
var socketRequests = {};

/**
 * Start testing mechanism as a separate thread
 */

const { fork } = require('child_process');
const forked = fork('./modules/SendTest.js');

// forked.on('message', (msg) => {
// 	log.info('Test sent', msg);
// });


// Socket communication configuration for RPC client
// =================================================
var socket = io.connect('http://localhost:3000', {
	reconnect: true
});
socket.on('connect', function () {
	log.info('Socket connected to IPC-RPC Communication server on port ' + 3000);
});

socket.on('event', function (data) {
	const reqNum = data.clientRequest;

	if (!socketRequests[reqNum]) {
		return;
	}

	socketRequests[reqNum].send(data.responseData);

	//console.log('data',data);
	//console.log('data.responseData',data.responseData);

	// Free request slot
	delete socketRequests[reqNum];

	return;
});

socket.on('disconnect', function () {
	log.info('IPC-RPC Communication disconnected');
});
// =================================================

// Node server configuration
// =========================
const server = restify.createServer({
	name: 'OriginTrail RPC server',
	version: '0.1.1'
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

server.use(
	function crossOrigin (req, res, next) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Headers', 'X-Requested-With');
		return next();
	}
);
// =========================

// API routes
// ==========

// Trail fetching
// ==============
server.get('/api/trail/batches', function (req, res) {
	var queryObject = req.query;

	var reqNum = utilities.getRandomInt(10000000000);

	while (socketRequests[reqNum] != undefined) {
		utilities.getRandomInt(10000000000);
	}
	socketRequests[reqNum] = res;
	socket.emit('event', {
		request: 'trail-request',
		queryObject: queryObject,
		clientRequest: reqNum
	});
});
// ====================

// Available expiration dates for product
// ======================================
server.get('/api/expiration_dates', function (req, res) {
	var queryObject = req.query;

	if (queryObject['internal_product_id'] != undefined) {
		queryObject['id.yimi_erp'] = queryObject['internal_product_id'];
		delete queryObject['internal_product_id'];
	}

	if (queryObject['expiration_date'] != undefined) {
		queryObject['id.expirationDate'] = queryObject['expiration_date'];
		delete queryObject['expiration_date'];
	}

	var reqNum = utilities.getRandomInt(10000000000);

	while (socketRequests[reqNum] != undefined) {
		utilities.getRandomInt(10000000000);
	}

	socketRequests[reqNum] = res;
	socket.emit('event', {
		request: 'expiration-request',
		queryObject: queryObject,
		clientRequest: reqNum
	});
});
// ======================================

// Blockchain fingerprint check
// ============================
server.get('/api/blockchain/check', function (req, res) {
	var queryObject = req.query;
	var reqNum = utilities.getRandomInt(10000000000);

	while (socketRequests[reqNum] != undefined) {
		utilities.getRandomInt(10000000000);
	}

	socketRequests[reqNum] = res;
	socket.emit('event', {
		request: 'blockchain-request',
		queryObject: queryObject,
		clientRequest: reqNum
	});
});


/*
* Imports data for replication
* Method: post
*
* @param json payload
*/

server.post('/api/replication', function (req, res) {
	let queryObject = req.body;

	//TODO: extract this as it repeats
	var reqNum = utilities.getRandomInt(10000000000);

	while (socketRequests[reqNum] != undefined) {
		utilities.getRandomInt(10000000000);
	}

	socketRequests[reqNum] = res;

	socket.emit('event', {
		request: 'replication-request',
		queryObject: queryObject,
		clientRequest: reqNum
	});
});

/**
 * Receive test request
 * Method: post
 *
 * @param json test
 */

server.post('/api/testing', function (req, res) {

	let queryObject = req.body;

	var reqNum = utilities.getRandomInt(10000000000);

	while (socketRequests[reqNum] != undefined) {
		utilities.getRandomInt(10000000000);
	}

	socketRequests[reqNum] = res;

	socket.emit('event', {
		request: 'testing-request',
		queryObject: queryObject,
		clientRequest: reqNum
	});
});

/**
 * Receive receipt
 * Method: post
 *
 * @param json receipt
 */

server.post('/api/receipt', function (req, res) {

	let queryObject = req.body;

	var reqNum = utilities.getRandomInt(10000000000);

	while (socketRequests[reqNum] != undefined) {
		utilities.getRandomInt(10000000000);
	}

	socketRequests[reqNum] = res;

	socket.emit('event', {
		request: 'receipt-request',
		queryObject: queryObject,
		clientRequest: reqNum
	});
});

// ============================

// Remote data import route
// ========================
server.post('/import', function (req, res) {

	log.info('[DC] Import request received!');

	var request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	var remote_access = utilities.getConfig().REMOTE_ACCESS;

	if (remote_access.find(function (ip) {
		return utilities.isIpEqual(ip, request_ip);
	}) == undefined) {
		res.send({
			message: 'Unauthorized request',
			data: []
		});
		return;
	}

	if (req.files == undefined || req.files.importfile == undefined) {
		res.send({
			status: 400,
			message: 'Input file not provided!'
		});
	} else {
		var selected_importer = 'default_importer';

		var post_body = req.body;

		var input_file = req.files.importfile.path;

		var reqNum = utilities.getRandomInt(10000000000);
/*
		if (req.body.noreplicate == undefined) {
			replication.replicate(input_file);
		}
*/
		socketRequests[reqNum] = res;
		var queryObject = {
			filepath: input_file
		};
		socket.emit('event', {
			request: 'import-request',
			queryObject: queryObject,
			clientRequest: reqNum
		});
	}
});
// ========================
// ==========

if(config.NODE_IP == '127.0.0.1')
{
	var client = natUpnp.createClient();
	client.portMapping({
		public: config.RPC_API_PORT,
		private: config.RPC_API_PORT,
		ttl: 0,
	}, function(err) {
		if(err)
		{
			log.info(err);
		}
		else
		{
			log.info('uPnP port mapping enabled, port: ' + config.RPC_API_PORT);
		}
	});

	client.portMapping({
		public: config.KADEMLIA_PORT,
		private: config.KADEMLIA_PORT,
		ttl: 0,
	}, function(err) {
		if(err)
		{
			log.info(err);
		}
		else
		{
			log.info('uPnP port mapping enabled, port: ' + config.KADEMLIA_PORT);
		}
	});



	client.externalIp(function(err, ip) {
		config.NODE_IP = ip;
		log.info(ip);
		kademlia.start();

		server.listen(parseInt(config.RPC_API_PORT), function () {
			log.info('%s listening at %s', server.name, server.url);
		});
	});
}
else
{
	kademlia.start();
	server.listen(parseInt(config.RPC_API_PORT), function () {
		log.info('%s listening at %s', server.name, server.url);
	});
}