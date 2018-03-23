// External modules and dependencies
const restify = require('restify');
const product = require('./modules/product')();
const socket_com = require('./modules/sockets')();
const importer = require('./modules/importer')();
const utilities = require('./modules/utilities')();

const config = utilities.getConfig();
const log = utilities.getLogger();
// Node server configuration
// =========================
const server = restify.createServer({
    name: 'OriginTrail IPC server',
    version: '0.3.0',
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
// =========================

// API routes
// ==========

// Get product batch trail by custom query parameters
// ==================================================
server.get('/api/trail/batches', (req, res) => {
    const queryObject = req.query;

    product.getTrailByQuery(queryObject, (trail_graph) => {
        res.send(trail_graph);
    });
});
// ==================================================

// Get product batch trail by product batch unique identifier
// ==========================================================
server.get('/api/trail/batches/:batch_uid', (req, res) => {
    product.getTrailByUID(req.params.batch_uid, (trail_graph) => {
        res.send(trail_graph);
    });
});
// ==========================================================

// Get expiration dates for product
// ================================
server.get('/api/expiration_dates', (req, res) => {
    const queryObject = req.query;

    product.getExpirationDates(queryObject, (trail_graph) => {
        res.send(trail_graph);
    });
});
// ================================

// Import xml file in database
// ===========================
server.post('/import', (req, res) => {
    if (req.files === undefined || req.files.importfile === undefined) {
        res.send({
            status: 400,
            message: 'Input file not provided!',
        });
    } else {
        const post_body = req.body;

        if (post_body.importer !== undefined) {
            // eslint-disable-next-line no-undef
            selected_importer = post_body.importer;
        }

        const input_file = req.files.importfile.path;
        importer.importXML(input_file, (data) => {
            res.send(data);
        });
    }
});
// ===========================
// ==========

socket_com.start();
// eslint-disable-next-line radix
server.listen(parseInt(config.IPC_API_PORT), 'localhost', () => {
    log.info('%s listening at %s', server.name, server.url);
});
