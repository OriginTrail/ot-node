// External modules and dependencies
const restify = require('restify');
const utilities = require('./modules/utilities');
const kademlia = require('./modules/kademlia')();
const replication = require('./modules/replication')();
const io = require('socket.io-client')('http://localhost:3000');

const config = utilities.getConfig();
const natUpnp = require('nat-upnp');

const log = utilities.getLogger();
// Active requests pool
const socketRequests = {};

/**
 * Start testing mechanism as a separate thread
 */

const { fork } = require('child_process');

const forked = fork('./modules/SendTest.js');

// forked.on('message', (msg) => {
// log.info('Test sent', msg);
// });


// Socket communication configuration for RPC client
// =================================================
const socket = io.connect('http://localhost:3000', {
    reconnect: true,
});
socket.on('connect', () => {
    log.info(`Socket connected to IPC-RPC Communication server on port ${3000}`);
});


socket.on('event', (data) => {
    const reqNum = data.clientRequest;

    if (!socketRequests[reqNum]) {
        return;
    }

    socketRequests[reqNum].send(data.responseData);


    // console.log('data',data);
    // console.log('data.responseData',data.responseData);


    // Free request slot
    delete socketRequests[reqNum];
});

socket.on('disconnect', () => {
    log.info('IPC-RPC Communication disconnected');
});
// =================================================

// Node server configuration
// =========================
const server = restify.createServer({
    name: 'OriginTrail RPC server',
    version: '0.1.1',
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
    return next();
});
// =========================

// API routes
// ==========

// Trail fetching
// ==============
server.get('/api/trail/batches', (req, res) => {
    const queryObject = req.query;

    const reqNum = utilities.getRandomInt(10000000000);

    while (socketRequests[reqNum] !== undefined) {
        utilities.getRandomInt(10000000000);
    }
    socketRequests[reqNum] = res;
    socket.emit('event', {
        request: 'trail-request',
        queryObject,
        clientRequest: reqNum,
    });
});
// ====================

// Available expiration dates for product
// ======================================
server.get('/api/expiration_dates', (req, res) => {
    const queryObject = req.query;

    if (queryObject.internal_product_id !== undefined) {
        queryObject['id.yimi_erp'] = queryObject.internal_product_id;
        delete queryObject.internal_product_id;
    }

    if (queryObject.expiration_date !== undefined) {
        queryObject['id.expirationDate'] = queryObject.expiration_date;
        delete queryObject.expiration_date;
    }

    const reqNum = utilities.getRandomInt(10000000000);

    while (socketRequests[reqNum] !== undefined) {
        utilities.getRandomInt(10000000000);
    }

    socketRequests[reqNum] = res;
    socket.emit('event', {
        request: 'expiration-request',
        queryObject,
        clientRequest: reqNum,
    });
});
// ======================================

// Blockchain fingerprint check
// ============================
server.get('/api/blockchain/check', (req, res) => {
    const queryObject = req.query;
    const reqNum = utilities.getRandomInt(10000000000);

    while (socketRequests[reqNum] !== undefined) {
        utilities.getRandomInt(10000000000);
    }

    socketRequests[reqNum] = res;
    socket.emit('event', {
        request: 'blockchain-request',
        queryObject,
        clientRequest: reqNum,
    });
});


/*
* Imports data for replication
* Method: post
*
* @param json payload
*/

server.post('/api/replication', (req, res) => {
    const queryObject = req.body;

    // TODO: extract this as it repeats
    const reqNum = utilities.getRandomInt(10000000000);

    while (socketRequests[reqNum] !== undefined) {
        utilities.getRandomInt(10000000000);
    }

    socketRequests[reqNum] = res;

    socket.emit('event', {
        request: 'replication-request',
        queryObject,
        clientRequest: reqNum,
    });
});

/**
 * Receive test request
 * Method: post
 *
 * @param json test
 */

server.post('/api/testing', (req, res) => {
    const queryObject = req.body;

    const reqNum = utilities.getRandomInt(10000000000);

    while (socketRequests[reqNum] !== undefined) {
        utilities.getRandomInt(10000000000);
    }

    socketRequests[reqNum] = res;

    socket.emit('event', {
        request: 'testing-request',
        queryObject,
        clientRequest: reqNum,
    });
});

/**
 * Receive receipt
 * Method: post
 *
 * @param json receipt
 */

server.post('/api/receipt', (req, res) => {
    const queryObject = req.body;

    const reqNum = utilities.getRandomInt(10000000000);

    while (socketRequests[reqNum] !== undefined) {
        utilities.getRandomInt(10000000000);
    }

    socketRequests[reqNum] = res;

    socket.emit('event', {
        request: 'receipt-request',
        queryObject,
        clientRequest: reqNum,
    });
});

// ============================

// Remote data import route
// ========================
server.post('/import', (req, res) => {
    log.info('[DC] Import request received!');

    const request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const remote_access = utilities.getConfig().REMOTE_ACCESS;

    if (remote_access.find(ip => utilities.isIpEqual(ip, request_ip)) === undefined) {
        res.send({
            message: 'Unauthorized request',
            data: [],
        });
        return;
    }

    if (req.files === undefined || req.files.importfile === undefined) {
        res.send({
            status: 400,
            message: 'Input file not provided!',
        });
    } else {
        const selected_importer = 'default_importer';

        const post_body = req.body;

        const input_file = req.files.importfile.path;

        const reqNum = utilities.getRandomInt(10000000000);

        // if (req.body.noreplicate ===undefined) {
        //     replication.replicate(input_file);
        // }

        socketRequests[reqNum] = res;
        const queryObject = {
            filepath: input_file,
        };
        socket.emit('event', {
            request: 'import-request',
            queryObject,
            clientRequest: reqNum,
        });
    }
});

server.post('/import_gs1', (req, res) => {
    log.info('[DC] Import request received!');

    const request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const remote_access = utilities.getConfig().REMOTE_ACCESS;

    if (remote_access.find(ip => utilities.isIpEqual(ip, request_ip)) === undefined) {
        res.send({
            message: 'Unauthorized request',
            data: [],
        });
        return;
    }

    if (req.files === undefined || req.files.importfile === undefined) {
        res.send({
            status: 400,
            message: 'Input file not provided!',
        });
    } else {
        const post_body = req.body;

        const input_file = req.files.importfile.path;

        const reqNum = utilities.getRandomInt(10000000000);

        socketRequests[reqNum] = res;
        const queryObject = {
            filepath: input_file,
        };
        socket.emit('event', {
            request: 'gs1import-request',
            queryObject,
            clientRequest: reqNum,
        });
    }
});
// ========================
// ==========

if (config.NODE_IP === '127.0.0.1') {
    const client = natUpnp.createClient();
    client.portMapping({
        public: config.RPC_API_PORT,
        private: config.RPC_API_PORT,
        ttl: 0,
    }, (err) => {
        if (err) {
            log.info(err);
        } else {
            log.info(`uPnP port mapping enabled, port: ${config.RPC_API_PORT}`);
        }
    });

    client.portMapping({
        public: config.KADEMLIA_PORT,
        private: config.KADEMLIA_PORT,
        ttl: 0,
    }, (err) => {
        if (err) {
            log.info(err);
        } else {
            log.info(`uPnP port mapping enabled, port: ${config.KADEMLIA_PORT}`);
        }
    });


    client.externalIp((err, ip) => {
        config.NODE_IP = ip;
        log.info(ip);
        kademlia.start();

        // eslint-disable-next-line radix
        server.listen(parseInt(config.RPC_API_PORT), () => {
            log.info('%s listening at %s', server.name, server.url);
        });
    });
} else {
    kademlia.start();
    // eslint-disable-next-line radix
    server.listen(parseInt(config.RPC_API_PORT), () => {
        log.info('%s listening at %s', server.name, server.url);
    });
}
