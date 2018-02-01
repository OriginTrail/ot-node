// External modules and dependencies
var restify = require('restify');
var utilities = require('./modules/utilities')();
var kademlia = require('./modules/kademlia')();
var replication = require('./modules/replication')();
var io = require('socket.io-client')('http://localhost:3000');
var config = utilities.getConfig();

// Active requests pool
var socketRequests = {};

// Socket communication configuration for RPC client
// =================================================
var socket = io.connect('http://localhost:3000', {reconnect: true});
	socket.on('connect', function(){
		console.log('Socket connected to IPC-RPC Communication server on port ' + 3000);
	});

	socket.on('event', function(data){

		var reqNum = data.clientRequest;
		socketRequests[reqNum].send(data.responseData);

    // Free request slot
		delete socketRequests[reqNum];

  });

  socket.on('disconnect', function(){
    console.log('IPC-RPC Communication disconnected');
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
  function crossOrigin(req,res,next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
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

  // YIMISHIJI specific query rewrite
  //=================================
  if(queryObject["internal_product_id"] != undefined)
  {
    queryObject["id.yimi_erp"] = queryObject["internal_product_id"];
    delete queryObject["internal_product_id"];
  }

  if(queryObject["expiration_date"] != undefined)
  {
    queryObject["id.expirationDate"] = queryObject["expiration_date"];
    delete queryObject["expiration_date"];
  }
  //=================================

	var reqNum = utilities.getRandomInt(10000000000);

  while(socketRequests[reqNum] != undefined)
  {
    utilities.getRandomInt(10000000000);
  }

	socketRequests[reqNum] = res;
  socket.emit('event', {request: 'trail-request', queryObject: queryObject, clientRequest: reqNum});

});
// ====================

// Available expiration dates for product
// ======================================
server.get('/api/expiration_dates', function (req, res) {

  var queryObject = req.query;
  var reqNum = utilities.getRandomInt(10000000000);

  if(queryObject["internal_product_id"] != undefined)
  {
    queryObject["id.yimi_erp"] = queryObject["internal_product_id"];
    delete queryObject["internal_product_id"];
  }

  if(queryObject["expiration_date"] != undefined)
  {
    queryObject["id.expirationDate"] = queryObject["expiration_date"];
    delete queryObject["expiration_date"];
  }

  var reqNum = utilities.getRandomInt(10000000000);

  while(socketRequests[reqNum] != undefined)
  {
    utilities.getRandomInt(10000000000);
  }

  socketRequests[reqNum] = res;
  socket.emit('event', {request: 'expiration-request', queryObject: queryObject, clientRequest: reqNum});
});
// ======================================

// Blockchain fingerprint check
// ============================
server.get('/api/blockchain/check', function (req, res) {

  var queryObject = req.query;
  var reqNum = utilities.getRandomInt(10000000000);

  while(socketRequests[reqNum] != undefined)
  {
    utilities.getRandomInt(10000000000);
  }

  socketRequests[reqNum] = res;
  socket.emit('event', {request: 'blockchain-request', queryObject: queryObject, clientRequest: reqNum});
});
// ============================

// Remote data import route
// ========================
server.post('/import', function (req, res) {    

  var request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var remote_access = utilities.getConfig().REMOTE_ACCESS;

  if(remote_access.find(function(ip){
    return utilities.isIpEqual(ip, request_ip);
  }) == undefined ){
    res.send({message: "Unauthorized request", data: []});
    return;
  }

  if(req.files == undefined || req.files.importfile == undefined){
    res.send({status: 400, message: 'Input file not provided!'});
  }

  else{
    var selected_importer = 'default_importer';

    var post_body = req.body;

    if(post_body.importer != undefined)
      selected_importer = post_body.importer;

    var input_file = req.files.importfile.path;

    var reqNum = utilities.getRandomInt(10000000000);

    if(req.body.noreplicate == undefined)
      replication.replicate(input_file, selected_importer);

    socketRequests[reqNum] = res;
    var queryObject = {importer: selected_importer, filepath: input_file};
    socket.emit('event', {request: 'import-request', queryObject: queryObject, clientRequest: reqNum});

  }
});
// ========================
// ==========

kademlia.start();

server.listen(parseInt(config.RPC_API_PORT), function () {
        console.log('%s listening at %s', server.name, server.url);
    });