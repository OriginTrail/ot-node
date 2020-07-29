const path = require('path');
const { QueryTypes } = require('sequelize');
const fs = require('fs');
const BN = require('bn.js');
const pjson = require('../../package.json');
const RestAPIValidator = require('../validator/rest-api-validator');
const ImportUtilities = require('../ImportUtilities');
const Utilities = require('../Utilities');
const Models = require('../../models');

class RestAPIServiceV2 {
    constructor(ctx) {
        this.ctx = ctx;
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.apiUtilities = ctx.apiUtilities;
        this.emitter = ctx.emitter;
        this.commandExecutor = ctx.commandExecutor;
        this.epcisOtJsonTranspiler = ctx.epcisOtJsonTranspiler;
        this.wotOtJsonTranspiler = ctx.wotOtJsonTranspiler;

        this.dcController = ctx.dcController;
        this.dhController = ctx.dhController;
        this.dvController = ctx.dvController;
        this.infoController = ctx.infoController;

        this.exportController = ctx.exportController;
        this.remoteControl = ctx.remoteControl;

        this.graphStorage = ctx.graphStorage;
        this.importService = ctx.importService;

        this.version_id = 'v2.0';
        this.stanards = ['OT-JSON', 'GS1-EPCIS', 'GRAPH', 'WOT'];
        this.trading_type_purchased = 'PURCHASED';
        this.trading_type_sold = 'SOLD';
        this.trading_type_all = 'ALL';
        this.trading_types = [
            this.trading_type_purchased, this.trading_type_sold, this.trading_type_all,
        ];
        this.graphStorage = ctx.graphStorage;
        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('ot-json', 'ot-json');
        this.mapping_standards_for_event.set('gs1-epcis', 'gs1');
        this.mapping_standards_for_event.set('graph', 'ot-json');
        this.mapping_standards_for_event.set('wot', 'wot');
    }

    /**
     * API Routes
     */
    _exposeAPIRoutes(server) {
        const {
            transport, emitter, blockchain, web3, config,
        } = this.ctx;

        server.get(`/api/${this.version_id}/info`, async (req, res) => {
            await this.infoController.getNodeInfo(req, res);
        });

        server.post(`/api/${this.version_id}/import`, async (req, res) => {
            await this._importDataset(req, res);
        });

        server.get(`/api/${this.version_id}/import/result/:handler_id`, async (req, res) => {
            await this._checkForHandlerStatus(req, res);
        });

        server.post(`/api/${this.version_id}/replicate`, async (req, res) => {
            await this._replicateDataset(req, res);
        });

        server.get(`/api/${this.version_id}/replicate/result/:handler_id`, async (req, res) => {
            await this._checkForReplicationHandlerStatus(req, res);
        });

        server.post(`/api/${this.version_id}/export`, async (req, res) => {
            await this.exportController.exportDataset(req, res);
        });

        server.get(`/api/${this.version_id}/export/result/:handler_id`, async (req, res) => {
            await this.exportController.checkForHandlerStatus(req, res);
        });

        server.get(`/api/${this.version_id}/standards`, async (req, res) => {
            this._getStandards(req, res);
        });

        server.get(`/api/${this.version_id}/get_element_issuer_identity/:element_id`, async (req, res) => {
            await this._getElementIssuerIdentity(req, res);
        });

        server.get(`/api/${this.version_id}/get_connection_types/:standard_id`, async (req, res) => {
            await this._getConnectionTypes(req, res);
        });

        server.get(`/api/${this.version_id}/get_dataset_info/:dataset_id`, async (req, res) => {
            await this.infoController.getDatasetInfo(req, res);
        });

        server.post(`/api/${this.version_id}/trail`, async (req, res) => {
            await this._getTrail(req, res);
        });

        server.post(`/api/${this.version_id}/get_merkle_proofs`, async (req, res) => {
            await this._getMerkleProofs(req, res);
        });

        server.post(`/api/${this.version_id}/network/query`, async (req, res) => {
            await this._networkQuery(req, res);
        });

        server.get(`/api/${this.version_id}/network/query/result/:query_id`, async (req, res) => {
            await this._networkQueryStatus(req, res);
        });

        server.get(`/api/${this.version_id}/network/query/responses/:query_id`, async (req, res) => {
            await this._networkQueryResponses(req, res);
        });

        server.post(`/api/${this.version_id}/network/read`, async (req, res) => {
            await this._readNetwork(req, res);
        });

        server.get(`/api/${this.version_id}/network/read/result/:handler_id`, async (req, res) => {
            await this._checkForHandlerStatus(req, res);
        });
        //
        // server.post(`/api/${this.version_id}/network/permissioned_data/read`,async(req, res) => {
        //     await this._privateDataReadNetwork(req, res);
        // });

        // server.get(`/api/${this.version_id}/network/permissioned_data/read/resu
        // lt/:handler_id`, async (req, res) => {
        //     await this._checkForHandlerStatus(req, res);
        // });

        // server.post(`/api/${this.version_id}/network/
        // permissioned_data/purchase`, async (req, res) => {
        //     await this.dvController.sendNetworkPurchase(req, res);
        // });

        // server.get(`/api/${this.version_id}/network/
        // permissioned_data/purchase/result/:handler_id`, async (req, res) => {
        //     await this._checkForHandlerStatus(req, res);
        // });

        server.post(`/api/${this.version_id}/permissioned_data/whitelist_viewer`, async (req, res) => {
            await this.dhController.whitelistViewer(req, res);
        });

        server.post(`/api/${this.version_id}/network/read_export`, async (req, res) => {
            await this.dvController.handleDataReadExportRequest(req, res);
        });

        server.get(`/api/${this.version_id}/network/read_export/result/:handler_id`, async (req, res) => {
            await this.exportController.checkForHandlerStatus(req, res);
        });

        server.post(`/api/${this.version_id}/challenges`, async (req, res) => {
            await this._getChallenges(req, res);
        });

        // server.get(`/api/${this.version_id}/permissioned_data/available`, async (req, res) => {
        //     await this._getPermissionedDataAvailable(req, res);
        // });
        //
        //
        // server.get(`/api/${this.version_id}/permissioned_data/owned`, async (req, res) => {
        //     await this._getPermissionedDataOwned(req, res);
        // });
        //
        // server.post(`/api/${this.version_id}/network/
        // permissioned_data/get_price`, async (req, res) => {
        //     await this._getPermissionedDataPrice(req, res);
        // });
        //
        // server.post(`/api/${this.version_id}/
        // permissioned_data/update_price`, async (req, res) => {
        //     await this._updatePermissionedDataPrice(req, res);
        // });
        //
        // server.get(`/api/${this.version_id}/network/
        // permissioned_data/get_price/result/:handler_id`, async (req, res) => {
        //     await this._checkForHandlerStatus(req, res);
        // });
        //
        // server.get(`/api/${this.version_id}/
        // permissioned_data/trading_info/:type`, async (req, res) => {
        //     await this._getTradingData(req, res);
        // });


        /** Network related routes */
        server.get(`/api/${this.version_id}/network/get-contact/:node_id`, async (req, res) => {
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

        server.get(`/api/${this.version_id}/network/find/:node_id`, async (req, res) => {
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

        /**
         * Temporary route used for HTTP network prototype
         */
        server.post(`/api/${this.version_id}/network/send`, (req, res) => {
            this.logger.api('P2P request received');

            const { type } = req.body;
            emitter.emit(type, req, res);
        });

        server.post(`/api/${this.version_id}/query/local`, (req, res, next) => {
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

        server.get(`/api/${this.version_id}/query/local/import/:data_set_id`, (req, res) => {
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


        server.get(`/api/${this.version_id}/consensus/:sender_id`, (req, res) => {
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
         * Payout route
         * @param Query params: data_set_id
         */
        server.get(`/api/${this.version_id}/payout`, (req, res) => {
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

        /** Get root hash for provided data query
         * @param Query params: data_set_id
         */
        server.get(`/api/${this.version_id}/fingerprint/:dataset_id`, (req, res) => {
            this.dvController.handleGetFingerprint(req, res);
        });

        server.get(`/api/${this.version_id}/import_info`, async (req, res) => {
            this.logger.api('GET: import_info.');

            const queryObject = req.query;
            if (queryObject.data_set_id == null) {
                res.send({ status: 400, message: 'Missing parameter!', data: [] });
                return;
            }

            this.emitter.emit('api-import-info', {
                dataSetId: queryObject.data_set_id,
                responseFormat: queryObject.format || 'otjson',
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/balance`, async (req, res) => {
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

        server.get(`/api/${this.version_id}/imports_info`, (req, res) => {
            this.logger.api('GET: List imports request received.');

            emitter.emit('api-imports-info', {
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/dump/rt`, (req, res) => {
            this.logger.api('Dumping routing table');
            const message = transport.dumpContacts();

            res.status(200);
            res.send({
                message,
            });
        });
    }

    async _getTrail(req, res) {
        this.logger.api('POST: Trail request received.');

        await this.dhController.getTrail(req, res);
    }

    async _getMerkleProofs(req, res) {
        this.logger.api('POST: Get Merkle proofs request received.');

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        if (req.body.object_ids === undefined ||
            req.body.dataset_id === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        const { object_ids, dataset_id } = req.body;

        const response =
            await this.importService.getMerkleProofs(Utilities.arrayze(object_ids), dataset_id);

        res.status(200);
        res.send(response);
    }

    async _networkQuery(req, res) {
        this.logger.api('POST: Network query request received.');

        let error = RestAPIValidator.validateBodyRequired(req.body);
        if (error) {
            res.status(400);
            res.send({
                message: error.message,
            });
            return;
        }

        const { query } = req.body;
        error = RestAPIValidator.validateSearchQuery(query);
        if (error) {
            res.status(400);
            res.send({
                message: error.message,
            });
            return;
        }

        this.logger.info('Network-query handling triggered.');

        const queryId = await this.dvController.queryNetwork(query, res);

        if (queryId) {
            res.status(200);
            res.send({
                query_id: queryId,
            });
        }
    }

    async _networkQueryStatus(req, res) {
        this.logger.api('GET: Query for status request received.');

        if (!req.params.query_id) {
            res.status(400);
            res.send({
                message: 'Missing Query ID parameter.',
            });
            return;
        }

        await this.dvController.handleNetworkQueryStatus(req.params.query_id, res);
    }

    async _networkQueryResponses(req, res) {
        this.logger.api('GET: Local query responses request received.');

        if (!req.params.query_id) {
            res.status(400);
            res.send({
                message: 'Param query_id is required.',
            });
            return;
        }

        await this.dvController.getNetworkQueryResponses(req.params.query_id, res);
    }

    async _readNetwork(req, res) {
        this.logger.api('POST: Network read request received.');

        if (req.body == null || req.body.reply_id == null
            || req.body.data_set_id == null) {
            res.status(400);
            res.send({ message: 'Params reply_id and data_set_id are required.' });
            return;
        }
        const { reply_id, data_set_id } = req.body;

        await this.dvController.handleDataReadRequest(data_set_id, reply_id, res);
    }

    // async _privateDataReadNetwork(req, res) {
    //     this.logger.api('Private data network read request received.');
    //
    //     if (!req.body || !req.body.seller_node_id
    //     || !req.body.data_set_id
    //     || !req.body.ot_object_id) {
    //         res.status(400);
    //         res.send({ message: 'Params data_set_id,
    //         ot_object_id and seller_node_id are required.' });
    //     }
    //     const { data_set_id, ot_object_id, seller_node_id } = req.body;
    //     await this.dvController
    //         .handlePermissionedDataReadRequest(data_set_id, ot_object_id, seller_node_id, res);
    // }

    async _checkForReplicationHandlerStatus(req, res) {
        const handler_object = await Models.handler_ids.findOne({
            where: {
                handler_id: req.params.handler_id,
            },
        });

        if (handler_object == null) {
            this.logger.info('Invalid request');
            res.status(404);
            res.send({
                message: 'Unable to find data with given parameters!',
            });
            return;
        }
        const handlerData = JSON.parse(handler_object.data);

        const offerData = {
            status: handlerData.status,
            holders: handlerData.holders,
        };
        const offer = await Models.offers.findOne({
            where: {
                [Models.Sequelize.Op.or]: [
                    {
                        offer_id: handlerData.offer_id,
                    },
                    {
                        id: handlerData.offer_id,
                    },
                ],
            },
        });
        if (offer) {
            offerData.number_of_replications = offer.number_of_replications;
            offerData.number_of_verified_replications = offer.number_of_verified_replications;
            offerData.trac_in_eth_used_for_price_calculation =
                offer.trac_in_eth_used_for_price_calculation;
            offerData.gas_price_used_for_price_calculation =
                offer.gas_price_used_for_price_calculation;
            offerData.price_factor_used_for_price_calculation =
                offer.price_factor_used_for_price_calculation;
            offerData.offer_create_transaction_hash = offer.transaction_hash;
            offerData.offer_finalize_transaction_hash = offer.offer_finalize_transaction_hash;
            offerData.offer_id = offer.offer_id;
            offerData.holding_time_in_minutes = offer.holding_time_in_minutes;
            offerData.token_amount_per_holder = offer.token_amount_per_holder;
            offerData.message = offer.message;
        }
        Object.keys(offerData).forEach(key => (offerData[key] == null) && delete offerData[key]);
        res.status(200);
        res.send({
            data: offerData,
            status: handler_object.status,
        });
    }

    async _checkForHandlerStatus(req, res) {
        const handler_object = await Models.handler_ids.findOne({
            where: {
                handler_id: req.params.handler_id,
            },
        });

        if (handler_object == null) {
            this.logger.info('Invalid request');
            res.status(404);
            res.send({
                message: 'Unable to find data with given parameters!',
            });
            return;
        }

        const { data, status } = handler_object;

        res.status(200);
        res.send({
            data: JSON.parse(data),
            status,
        });
    }

    async _getChallenges(req, res) {
        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        // Check if import type is valid
        if (req.body.startDate === undefined ||
            req.body.endDate === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request startDate and endDate required!',
            });
            return;
        }

        const challenges = await Models.challenges.findAll({
            where: {
                start_time: {
                    [Models.Sequelize.Op.between]:
                        [(new Date(req.body.startDate)).getTime(),
                            (new Date(req.body.endDate)).getTime()],
                },
                status: {
                    [Models.Sequelize.Op.not]: 'PENDING',
                },
            },
            order: [
                ['start_time', 'ASC'],
            ],
        });
        const returnChallenges = [];
        challenges.forEach((challenge) => {
            const answered = !!challenge.answer;
            returnChallenges.push({
                offer_id: challenge.offer_id,
                start_time: challenge.start_time,
                status: challenge.status,
                answered,
            });
        });

        res.status(200);
        res.send(returnChallenges);
    }

    // This is hardcoded import in case it is needed to make new importer with this method
    async _importDataset(req, res) {
        this.logger.api('POST: Import of data request received.');

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        // Check if import type is valid
        if (req.body.standard_id === undefined ||
            this.stanards.indexOf(req.body.standard_id) === -1) {
            res.status(400);
            res.send({
                message: 'Invalid import type',
            });
            return;
        }

        const standard_id =
            this.mapping_standards_for_event.get(req.body.standard_id.toLowerCase());

        let fileContent;
        if (req.files !== undefined && req.files.file !== undefined) {
            const inputFile = req.files.file.path;
            fileContent = await Utilities.fileContents(inputFile);
        } else if (req.body.file !== undefined) {
            fileContent = req.body.file;
        }

        if (fileContent) {
            try {
                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });

                const cacheDirectory = path.join(this.config.appDataPath, 'import_cache');

                try {
                    await Utilities.writeContentsToFile(
                        cacheDirectory,
                        inserted_object.dataValues.handler_id,
                        fileContent,
                    );
                } catch (e) {
                    const filePath =
                        path.join(cacheDirectory, inserted_object.dataValues.handler_id);

                    if (fs.existsSync(filePath)) {
                        await Utilities.deleteDirectory(filePath);
                    }
                    res.status(500);
                    res.send({
                        message: `Error when creating import cache file for handler_id ${inserted_object.dataValues.handler_id}. ${e.message}`,
                    });
                    return;
                }

                const commandData = {
                    standard_id,
                    documentPath: path.join(cacheDirectory, inserted_object.dataValues.handler_id),
                    handler_id: inserted_object.dataValues.handler_id,
                };
                const commandSequence = [
                    'dcConvertToOtJsonCommand',
                    'dcConvertToGraphCommand',
                    'dcWriteImportToGraphDbCommand',
                    'dcFinalizeImportCommand',
                ];

                await this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: commandData,
                    transactional: false,
                });
                res.status(200);
                res.send({
                    handler_id: inserted_object.dataValues.handler_id,
                });
            } catch (e) {
                res.status(400);
                res.send({
                    message: 'No import data provided',
                });
            }
        } else {
            res.status(400);
            res.send({
                message: 'No import data provided',
            });
        }
    }

    async _replicateDataset(req, res) {
        this.logger.api('POST: Replication of imported data request received.');

        this.dcController.handleReplicateRequest(req, res);
    }

    /**
     * Get all supported standards
     * @param req
     * @param res
     * @private
     */
    _getStandards(req, res) {
        const msg = [];
        this.stanards.forEach(standard =>
            msg.push(standard));
        res.send({
            message: msg,
        });
    }

    _getConnectionTypes(req, res) {
        const standard_id = req.params.standard_id.toLocaleLowerCase();
        if (standard_id === 'gs1') {
            res.status(200);
            res.send({ connection_types: this.epcisOtJsonTranspiler.getConnectionTypes() });
        } else if (standard_id === 'wot') {
            res.status(200);
            res.send({ connection_types: this.wotOtJsonTranspiler.getConnectionTypes() });
        } else {
            res.status(400);
            res.send({
                message: 'Invalid type request',
            });
        }
    }

    /**
     * Returns element issuer identity
     * @param req
     * @param res
     * @returns {Promise<void>}
     * @private
     */
    async _getElementIssuerIdentity(req, res) {
        this.logger.api('GET: Element issuer identity request received.');
        const elementId = req.params.element_id;
        if (!elementId) {
            res.status(400);
            res.send({
                message: 'Param element_id is required.',
            });
            return;
        }
        const result = await this.graphStorage.findIssuerIdentityForElementId(elementId);
        if (result && result.length > 0) {
            res.status(200);
            res.send(result);
        } else {
            res.status(400);
            res.send({
                message: 'Unable to find requested data',
            });
        }
    }


    // async _networkPurchase(req, res) {
    //     this.logger.api('POST: Network purchase request received.');
    //
    //     if (req.body == null
    //         || req.body.data_set_id == null
    //         || req.body.seller_node_id == null
    //         || req.body.ot_object_id == null) {
    //         res.status(400);
    //         res.send({ message: '
    //         Params data_set_id, seller_node_id and ot_object_id are required.' });
    //         return;
    //     }
    //     const {
    //         data_set_id, seller_node_id, ot_object_id,
    //     } = req.body;
    //     const inserted_object = await Models.handler_ids.create({
    //         data: JSON.stringify({
    //             data_set_id, seller_node_id, ot_object_id,
    //         }),
    //         status: 'PENDING',
    //     });
    //     const handlerId = inserted_object.dataValues.handler_id;
    //     res.status(200);
    //     res.send({
    //         handler_id: handlerId,
    //     });
    //
    //     await this.dvController.sendNetworkPurchase(
    //         data_set_id,
    //         this.config.erc725Identity,
    //         seller_node_id,
    //         ot_object_id,
    //         handlerId,
    //     );
    // }

    async _getPermissionedDataAvailable(req, res) {
        this.logger.api('GET: Permissioned data Available for purchase.');

        const query = 'SELECT * FROM data_sellers DS WHERE NOT EXISTS(SELECT * FROM data_sellers MY WHERE MY.seller_erc_id = :seller_erc AND MY.data_set_id = DS.data_set_id AND MY.ot_json_object_id = DS.ot_json_object_id)';
        const data = await Models.sequelize.query(
            query,
            {
                replacements: { seller_erc: Utilities.normalizeHex(this.config.erc725Identity) },
                type: QueryTypes.SELECT,
            },
        );

        const result = [];

        if (data.length > 0) {
            const not_owned_objects = {};
            const allDatasets = [];
            /*
               Creating a map of the following structure
               not_owned_objects: {
                    dataset_0x456: {
                        seller_0x123: [ot_object_0x789, ...]
                        ...,
                    },
                    ...
               }
             */
            data.forEach((obj) => {
                if (not_owned_objects[obj.data_set_id]) {
                    if (not_owned_objects[obj.data_set_id][obj.seller_node_id]) {
                        not_owned_objects[obj.data_set_id][obj.seller_node_id].ot_json_object_id
                            .push(obj.ot_json_object_id);
                    } else {
                        not_owned_objects[obj.data_set_id][obj.seller_node_id].ot_json_object_id
                            = [obj.ot_json_object_id];
                        not_owned_objects[obj.data_set_id][obj.seller_node_id].seller_erc_id
                            = obj.seller_erc_id;
                    }
                } else {
                    allDatasets.push(obj.data_set_id);
                    not_owned_objects[obj.data_set_id] = {};
                    not_owned_objects[obj.data_set_id][obj.seller_node_id] = {};
                    not_owned_objects[obj.data_set_id][obj.seller_node_id].ot_json_object_id
                        = [obj.ot_json_object_id];
                    not_owned_objects[obj.data_set_id][obj.seller_node_id].seller_erc_id
                        = obj.seller_erc_id;
                }
            });

            const allMetadata = await this.importService.getMultipleDatasetMetadata(allDatasets);

            const dataInfos = await Models.data_info.findAll({
                where: {
                    data_set_id: {
                        [Models.sequelize.Op.in]: allDatasets,
                    },
                },
            });

            allDatasets.forEach((datasetId) => {
                const { datasetHeader } = allMetadata.find(metadata => metadata._key === datasetId);
                const dataInfo = dataInfos.find(info => info.data_set_id === datasetId);
                not_owned_objects[datasetId].metadata = {
                    datasetTitle: datasetHeader.datasetTitle,
                    datasetTags: datasetHeader.datasetTags,
                    datasetDescription: datasetHeader.datasetDescription,
                    timestamp: dataInfo.import_timestamp,
                };
            });

            for (const dataset in not_owned_objects) {
                for (const data_seller in not_owned_objects[dataset]) {
                    if (data_seller !== 'metadata') {
                        result.push({
                            seller_node_id: data_seller,
                            timestamp: (new Date(not_owned_objects[dataset].metadata.timestamp))
                                .getTime(),
                            dataset: {
                                id: dataset,
                                name: not_owned_objects[dataset].metadata.datasetTitle,
                                description: not_owned_objects[dataset].metadata.datasetDescription,
                                tags: not_owned_objects[dataset].metadata.datasetTags,
                            },
                            ot_objects: not_owned_objects[dataset][data_seller].ot_json_object_id,
                            seller_erc_id: not_owned_objects[dataset][data_seller].seller_erc_id,
                        });
                    }
                }
            }
        }

        res.status(200);
        res.send(result);
    }

    async _getPermissionedDataOwned(req, res) {
        this.logger.api('GET: Permissioned Data Owned.');

        const query = 'SELECT ds.data_set_id, ds.ot_json_object_id, ds.price, ( SELECT Count(*) FROM data_trades dt Where dt.seller_erc_id = ds.seller_erc_id and ds.data_set_id = dt.data_set_id and ds.ot_json_object_id = dt.ot_json_object_id ) as sales FROM  data_sellers ds where ds.seller_erc_id = :seller_erc ';
        const data = await Models.sequelize.query(
            query,
            {
                replacements: { seller_erc: Utilities.normalizeHex(this.config.erc725Identity) },
                type: QueryTypes.SELECT,
            },
        );

        const result = [];

        if (data.length > 0) {
            const owned_objects = {};
            const allDatasets = [];
            /*
               Creating a map of the following structure
               owned_objects: {
                    dataset_0x456: {
                        ot_objects: [ot_object_0x789, ...]
                        ...,
                    },
                    ...
               }
             */
            data.forEach((obj) => {
                if (owned_objects[obj.data_set_id]) {
                    owned_objects[obj.data_set_id].ot_objects.push({
                        id: obj.ot_json_object_id,
                        price: obj.price,
                        sales: obj.sales,
                    });
                    owned_objects[obj.data_set_id].total_sales.iadd(new BN(obj.sales, 10));
                    owned_objects[obj.data_set_id].total_price.iadd(new BN(obj.price, 10));
                } else {
                    allDatasets.push(obj.data_set_id);
                    owned_objects[obj.data_set_id] = {};
                    owned_objects[obj.data_set_id].ot_objects = [{
                        id: obj.ot_json_object_id,
                        price: obj.price,
                        sales: obj.sales,
                    }];
                    owned_objects[obj.data_set_id].total_sales = new BN(obj.sales, 10);
                    owned_objects[obj.data_set_id].total_price = new BN(obj.price, 10);
                }
            });

            const allMetadata = await this.importService.getMultipleDatasetMetadata(allDatasets);

            const dataInfos = await Models.data_info.findAll({
                where: {
                    data_set_id: {
                        [Models.sequelize.Op.in]: allDatasets,
                    },
                },
            });

            allDatasets.forEach((datasetId) => {
                const { datasetHeader } = allMetadata.find(metadata => metadata._key === datasetId);
                const dataInfo = dataInfos.find(info => info.data_set_id === datasetId);
                owned_objects[datasetId].metadata = {
                    datasetTitle: datasetHeader.datasetTitle,
                    datasetTags: datasetHeader.datasetTags,
                    datasetDescription: datasetHeader.datasetDescription,
                    timestamp: dataInfo.import_timestamp,
                };
            });

            for (const dataset in owned_objects) {
                result.push({
                    timestamp: (new Date(owned_objects[dataset].metadata.timestamp)).getTime(),
                    dataset: {
                        id: dataset,
                        name: owned_objects[dataset].metadata.datasetTitle,
                        description: owned_objects[dataset].metadata.datasetDescription || 'No description given',
                        tags: owned_objects[dataset].metadata.datasetTags,
                    },
                    ot_objects: owned_objects[dataset].ot_objects,
                    total_sales: owned_objects[dataset].total_sales.toString(),
                    total_price: owned_objects[dataset].total_price.toString(),
                });
            }
        }

        res.status(200);
        res.send(result);
    }

    async _getPermissionedDataPrice(req, res) {
        this.logger.api('POST: Get permissioned data price.');
        if (req.body == null
            || req.body.data_set_id == null
            || req.body.seller_node_id == null
            || req.body.ot_object_id == null) {
            res.status(400);
            res.send({ message: 'Params data_set_id, seller_node_id and ot_json_object_id are required.' });
        }

        const {
            data_set_id, seller_node_id, ot_object_id,
        } = req.body;
        const inserted_object = await Models.handler_ids.create({
            data: JSON.stringify({
                data_set_id, seller_node_id, ot_object_id,
            }),
            status: 'PENDING',
        });

        const handlerId = inserted_object.dataValues.handler_id;

        await this.dvController.sendPermissionedDataPriceRequest(
            data_set_id,
            seller_node_id,
            ot_object_id,
            handlerId,
        );

        res.status(200);
        res.send({
            handler_id: handlerId,
        });
    }

    async _updatePermissionedDataPrice(req, res) {
        this.logger.api('POST: Set permissioned data price.');
        if (req.body == null
            || req.body.data_set_id == null
            || req.body.ot_object_ids == null) {
            res.status(400);
            res.send({ message: 'Params data_set_id and ot_object_ids are required.' });
            return;
        }

        const promises = [];
        req.body.ot_object_ids.forEach((ot_object) => {
            promises.push(new Promise(async (accept, reject) => {
                const condition = {
                    seller_erc_id: this.config.erc725Identity.toLowerCase(),
                    data_set_id: req.body.data_set_id.toLowerCase(),
                    ot_json_object_id: ot_object.id,
                };

                const data = await Models.data_sellers.findOne({
                    where: condition,
                });

                if (data) {
                    await Models.data_sellers.update(
                        { price: ot_object.price_in_trac },
                        { where: { id: data.id } },
                    );
                    accept();
                } else {
                    reject();
                }
            }));
        });
        await Promise.all(promises).then(() => {
            res.status(200);
            res.send({ status: 'COMPLETED' });
        });
    }

    async _getTradingData(req, res) {
        this.logger.api('GET: Get trading data.');
        const requestedType = req.params.type;
        if (!requestedType || !this.trading_types.includes(requestedType)) {
            res.status(400);
            res.send({
                message: 'Param type with values: PURCHASED, SOLD or ALL is required.',
            });
        }
        const normalizedIdentity = Utilities.normalizeHex(this.config.erc725Identity);
        const whereCondition = {};
        if (requestedType === this.trading_type_purchased) {
            whereCondition.buyer_erc_id = normalizedIdentity;
        } else if (requestedType === this.trading_type_sold) {
            whereCondition.seller_erc_id = normalizedIdentity;
        }

        const tradingData = await Models.data_trades.findAll({
            where: whereCondition,
            order: [
                ['timestamp', 'DESC'],
            ],
        });

        const allDatasets = tradingData.map(element => element.data_set_id)
            .filter((value, index, self) => self.indexOf(value) === index);

        const allMetadata = await this.importService.getMultipleDatasetMetadata(allDatasets);

        const returnArray = [];
        tradingData.forEach((element) => {
            const { datasetHeader } =
                allMetadata.find(metadata => metadata._key === element.data_set_id);
            const type = normalizedIdentity === element.buyer_erc_id ? 'PURCHASED' : 'SOLD';
            returnArray.push({
                data_set: {
                    id: element.data_set_id,
                    name: datasetHeader.datasetTitle,
                    description: datasetHeader.datasetDescription,
                    tags: datasetHeader.datasetTags,
                },
                ot_json_object_id: element.ot_json_object_id,
                buyer_erc_id: element.buyer_erc_id,
                buyer_node_id: element.buyer_node_id,
                seller_erc_id: element.seller_erc_id,
                seller_node_id: element.seller_node_id,
                price_in_trac: element.price_in_trac,
                purchase_id: element.purchase_id,
                timestamp: element.timestamp,
                type,
                status: element.status,
            });
        });

        res.status(200);
        res.send(returnArray);
    }
}


module.exports = RestAPIServiceV2;
