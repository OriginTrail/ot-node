const fs = require('fs');
const ip = require('ip');
const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');

const Utilities = require('../Utilities');
const pjson = require('../../package.json');
const RestAPIValidator = require('../validator/rest-api-validator');

const RestApiV2 = require('./rest-api-v2');

class RestAPIServiceV1 {
    constructor(ctx) {
        this.ctx = ctx;
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.apiUtilities = ctx.apiUtilities;

        this.stanards = ['GS1-EPCIS'];
    }

    /**
     * Expose bootstrap API Routes
     */
    // _exposeBootstrapAPIRoutes(server) {
    //     this._registerNodeInfoRoute(server, true);
    // }

    /**
     * API Routes
     */
    _exposeAPIRoutes(server) {
        const {
            importController, dcController, transport, emitter,
            blockchain, web3, config,
        } = this.ctx;

        this._registerNodeInfoRoute(server, false);

        server.get('/api/balance', async (req, res) => {
            this.logger.api('Get balance.');

            try {
                const humanReadable = req.query.humanReadable === 'true';

                const walletEthBalance = await web3.eth.getBalance(config.node_wallet);
                const walletTokenBalance = await Utilities.getTracTokenBalance(
                    web3,
                    config.node_wallet,
                    blockchain.getTokenContractAddress(),
                    false,
                );
                const profile = await blockchain.getProfile(config.erc725Identity);
                const profileMinimalStake = await blockchain.getProfileMinimumStake();

                const body = {
                    wallet: {
                        address: config.node_wallet,
                        ethBalance: humanReadable ? web3.utils.fromWei(walletEthBalance, 'ether') : walletEthBalance,
                        tokenBalance: humanReadable ? web3.utils.fromWei(walletTokenBalance, 'ether') : walletTokenBalance,
                    },
                    profile: {
                        staked: humanReadable ? web3.utils.fromWei(profile.stake, 'ether') : profile.stake,
                        reserved: humanReadable ? web3.utils.fromWei(profile.stakeReserved, 'ether') : profile.stakeReserved,
                        minimalStake: humanReadable ? web3.utils.fromWei(profileMinimalStake, 'ether') : profileMinimalStake,
                    },
                };

                res.status(200);
                res.send(body);
            } catch (error) {
                this.logger.error(`Failed to get balance. ${error.message}.`);
                res.status(503);
                res.send({});
            }
        });


        /**
         * Data import route
         * @param importfile - file or text data
         * @param importtype - (GS1/WOT)
         */
        // server.post('/api/import', async (req, res) => {
        //     // await importController.import(req, res);
        //     this.restApi.
        // });

        /**
         * Create offer route
         */
        server.post('/api/replication', async (req, res) => {
            await dcController.createOffer(req, res);
        });

        server.get('/api/dump/rt', (req, res) => {
            this.logger.api('Dumping routing table');
            const message = transport.dumpContacts();

            res.status(200);
            res.send({
                message,
            });
        });

        server.get('/api/network/get-contact/:node_id', async (req, res) => {
            const nodeId = req.params.node_id;
            this.logger.api(`Get contact node ID ${nodeId}`);

            const result = await transport.getContact(nodeId);
            const body = {};

            if (result) {
                Object.assign(body, result);
            }
            res.status(200);
            res.send(body);
        });

        server.get('/api/network/find/:node_id', async (req, res) => {
            const nodeId = req.params.node_id;
            this.logger.api(`Find node ID ${nodeId}`);

            const result = await transport.findNode(nodeId);
            const body = {};

            if (result) {
                Object.assign(body, result);
            }
            res.status(200);
            res.send(body);
        });

        server.get('/api/replication/:replication_id', (req, res) => {
            this.logger.api('GET: Replication status request received');

            const replicationId = req.params.replication_id;
            if (replicationId == null) {
                this.logger.error('Invalid request. You need to provide replication ID');
                res.status = 400;
                res.send({
                    message: 'Replication ID is not provided',
                });
            } else {
                const queryObject = {
                    replicationId,
                    response: res,
                };
                emitter.emit('api-offer-status', queryObject);
            }
        });

        /**
         * Get trail from database
         * @param QueryObject - ex. {uid: abc:123}
         */
        server.get('/api/trail', (req, res, next) => {
            this.logger.api('GET: Trail request received.');

            const error = RestAPIValidator.validateNotEmptyQuery(req.query);
            if (error) {
                return next(error);
            }
            const queryObject = req.query;
            emitter.emit('api-trail', {
                query: queryObject,
                response: res,
            });
        });

        /**
         * Get entity trail from database
         * @param QueryObject
         */
        server.post('/api/trail/entity', (req, res, next) => {
            this.logger.api('POST: Entity trail request received.');

            const error = RestAPIValidator.validateBodyRequired(req.body);
            if (error) {
                return next(error);
            }

            const queryObject = req.body;

            emitter.emit('api-trail-entity', {
                query: queryObject,
                response: res,
            });
        });

        /** Get root hash for provided data query
         * @param Query params: data_set_id
         */
        server.get('/api/fingerprint', (req, res) => {
            this.logger.api('GET: Fingerprint request received.');

            const queryObject = req.query;
            emitter.emit('api-get_root_hash', {
                query: queryObject,
                response: res,
            });
        });

        server.get('/api/query/network/:query_id', (req, res) => {
            this.logger.api('GET: Query for status request received.');

            if (!req.params.query_id) {
                res.status(400);
                res.send({
                    message: 'Param required.',
                });
                return;
            }
            emitter.emit('api-network-query-status', {
                id: req.params.query_id,
                response: res,
            });
        });

        server.get('/api/query/:query_id/responses', (req, res) => {
            this.logger.api('GET: Local query responses request received.');

            if (!req.params.query_id) {
                res.status(400);
                res.send({
                    message: 'Param query_id is required.',
                });
                return;
            }
            emitter.emit('api-network-query-responses', {
                query_id: req.params.query_id,
                response: res,
            });
        });

        server.post('/api/query/network', (req, res, next) => {
            this.logger.api('POST: Network query request received.');

            let error = RestAPIValidator.validateBodyRequired(req.body);
            if (error) {
                return next(error);
            }

            const { query } = req.body;
            error = RestAPIValidator.validateSearchQuery(query);
            if (error) {
                return next(error);
            }

            emitter.emit('api-network-query', {
                query,
                response: res,
            });
        });

        /**
         * Get vertices by query
         * @param queryObject
         */
        server.post('/api/query/local', (req, res, next) => {
            this.logger.api('POST: Local query request received.');

            let error = RestAPIValidator.validateBodyRequired(req.body);
            if (error) {
                return next(error);
            }

            const queryObject = req.body.query;
            error = RestAPIValidator.validateSearchQuery(queryObject);
            if (error) {
                return next(error);
            }

            // TODO: Decrypt returned vertices
            emitter.emit('api-query', {
                query: queryObject,
                response: res,
            });
        });

        server.get('/api/query/local/import/:data_set_id', (req, res) => {
            this.logger.api('GET: Local import request received.');

            if (!req.params.data_set_id) {
                res.status(400);
                res.send({
                    message: 'Param required.',
                });
                return;
            }

            emitter.emit('api-query-local-import', {
                data_set_id: req.params.data_set_id,
                format: ((req.query && req.query.format) || 'otjson'),
                encryption: req.query.encryption,
                request: req,
                response: res,
            });
        });

        server.post('/api/read/network', (req, res) => {
            this.logger.api('POST: Network read request received.');

            if (req.body == null || req.body.query_id == null || req.body.reply_id == null
                || req.body.data_set_id == null) {
                res.status(400);
                res.send({ message: 'Bad request' });
                return;
            }
            const { query_id, reply_id, data_set_id } = req.body;

            emitter.emit('api-choose-offer', {
                query_id,
                reply_id,
                data_set_id,
                response: res,
            });
        });

        server.get('/api/import_info', async (req, res) => {
            await importController.dataSetInfo(req, res);
        });

        server.get('/api/imports_info', (req, res) => {
            this.logger.api('GET: List imports request received.');

            emitter.emit('api-imports-info', {
                response: res,
            });
        });

        server.get('/api/standards', async (req, res) => {
            const msg = [];
            this.stanards.forEach(standard =>
                msg.push(standard));
            res.send({
                message: msg,
            });
        });

        server.get('/api/consensus/:sender_id', (req, res) => {
            this.logger.api('GET: Consensus check events request received.');

            if (req.params.sender_id == null) {
                res.status(400);
                res.send({ message: 'Bad request' });
            }

            emitter.emit('api-consensus-events', {
                sender_id: req.params.sender_id,
                response: res,
            });
        });

        /**
         * Temporary route used for HTTP network prototype
         */
        server.post('/network/send', (req, res) => {
            this.logger.api('P2P request received');

            const { type } = req.body;
            emitter.emit(type, req, res);
        });

        /**
         * Payout route
         * @param Query params: data_set_id
         */
        server.get('/api/payout', (req, res) => {
            this.logger.api('GET: Payout request received.');

            if (!req.query.offer_id) {
                res.status(400);
                res.send({
                    message: 'Param offer_id is required.',
                });
                return;
            }

            emitter.emit('api-payout', {
                offerId: req.query.offer_id,
                response: res,
            });
        });
    }

    /**
     * Register common info route
     * @param server - Server instance
     * @param isBootstrap - Is this a bootstrap node?
     * @private
     */
    _registerNodeInfoRoute(server, isBootstrap) {
        const {
            transport,
            config,
        } = this.ctx;

        server.get('/api/info', async (req, res) => {
            this.logger.api('GET: Node information request received.');

            try {
                const network = await transport.getNetworkInfo();
                const basicConfig = {
                    version: pjson.version,
                    blockchain: config.blockchain.blockchain_title,
                    network,
                    is_bootstrap: isBootstrap,
                };

                if (!isBootstrap) {
                    Object.assign(basicConfig, {
                        node_wallet: config.node_wallet,
                        erc_725_identity: config.erc725Identity,
                    });
                }

                res.status(200);
                res.send(basicConfig);
            } catch (error) {
                this.logger.error(`Failed to process /api/info route. ${error}`);
                res.status(500);
                res.send({
                    message: error,
                });
            }
        });
    }
}

module.exports = RestAPIServiceV1;
