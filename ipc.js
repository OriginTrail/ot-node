// External modules and dependencies
var restify = require('restify');
var aql = require('aql');
var product = require('./modules/product')();
var socket_com = require('./modules/sockets')();
var importer = require('./modules/importer')();
var utilities = require('./modules/utilities')();
var config = utilities.getConfig();


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

     product.getTrailByQuery(queryObject, function(trail_graph){
         res.send(trail_graph);
     });
});
// ==================================================

// Get product batch trail by product batch unique identifier
// ==========================================================
server.get('/api/trail/batches/:batch_uid', function (req, res) {

	var queryObject = { uid: req.params.batch_uid}

    product.getTrailByUID(req.params.batch_uid, function(trail_graph){
        res.send(trail_graph);
    });
});
// ==========================================================

// Get expiration dates for product
// ================================
server.get('/api/expiration_dates', function (req, res) {

    var queryObject = req.query;

     product.getExpirationDates(queryObject, function(trail_graph){
         res.send(trail_graph);
     });
});
// ================================

// Import xml file in database
// ===========================
server.post('/import', function (req, res) {    

    if(req.files == undefined || req.files.importfile == undefined){
        res.send({status: 400, message: 'Input file not provided!'});
    }

    else{

    	var selected_importer = 'default_importer';

    	var post_body = req.body;

    	if(post_body.importer != undefined)
    		selected_importer = post_body.importer;

       	var input_file = req.files.importfile.path;
        importer.importXML(input_file, selected_importer, function(data){
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