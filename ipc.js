// External modules and dependencies
const restify = require('restify');
const product = require('./modules/product')();
const socket_com = require('./modules/sockets')();
const importer = require('./modules/importer')();
const utilities = require('./modules/utilities')();
const config = utilities.getConfig();

// Node server configuration
// =========================
const server = restify.createServer({
	name: 'OriginTrail IPC server',
	version: '0.1.1'
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
// =========================

// API routes
// ==========

// Get product batch trail by custom query parameters
// ==================================================
server.get('/api/trail/batches', function (req, res) {
	var queryObject = req.query;

	product.getTrailByQuery(queryObject, function (trail_graph) {
		res.send(trail_graph);
	});
});
// ==================================================

// Get product batch trail by product batch unique identifier
// ==========================================================
server.get('/api/trail/batches/:batch_uid', function (req, res) {
	product.getTrailByUID(req.params.batch_uid, function (trail_graph) {
		res.send(trail_graph);
	});
});
// ==========================================================

// Get expiration dates for product
// ================================
server.get('/api/expiration_dates', function (req, res) {
	var queryObject = req.query;

	product.getExpirationDates(queryObject, function (trail_graph) {
		res.send(trail_graph);
	});
});
// ================================

// Import xml file in database
// ===========================
server.post('/import', function (req, res) {
	if (req.files == undefined || req.files.importfile == undefined) {
		res.send({
			status: 400,
			message: 'Input file not provided!'
		});
	} else {
		var post_body = req.body;

		if (post_body.importer != undefined) {
			selected_importer = post_body.importer;
		}

		var input_file = req.files.importfile.path;
		importer.importXML(input_file, function (data) {
			res.send(data);
		});
	}
});
// ===========================
// ==========

socket_com.start();

server.listen(parseInt(config.IPC_API_PORT), 'localhost', function () {
	console.log('%s listening at %s', server.name, server.url);
});
