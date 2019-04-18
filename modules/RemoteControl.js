const restify = require('restify');
const SocketIo = require('socket.io');
const deepExtend = require('deep-extend');
const fs = require('fs');

const Models = require('../models');
const Utilities = require('./Utilities');
const pjson = require('../package.json');

const { map } = require('p-iteration');

class SocketDecorator {
    constructor(log) {
        this.log = log;
        this.socket = null;
    }

    initialize(socket) {
        this.socket = socket;
    }

    emit(event, data) {
        if (this.socket && this.socket.connected) {
            try {
                this.socket.emit(event, data);
            } catch (e) {
                this.log.warn('Failed to emmit the event to the front end.');
            }
        }
    }

    on(event, callback) {
        if (this.socket && this.socket.connected) {
            this.socket.on(event, callback);
        }
    }
}

class RemoteControl {
    constructor(ctx) {
        this.transport = ctx.transport;
        this.graphStorage = ctx.graphStorage;
        this.blockchain = ctx.blockchain;
        this.log = ctx.logger;
        this.config = ctx.config;
        this.web3 = ctx.web3;
        this.socket = new SocketDecorator(ctx.logger);
        this.notifyError = ctx.notifyError;
        this.profileService = ctx.profileService;

        const serverOptions = {};
        if (this.config.node_rpc_use_ssl) {
            Object.assign(serverOptions, {
                key: fs.readFileSync(this.config.node_rpc_ssl_key_path),
                certificate: fs.readFileSync(this.config.node_rpc_ssl_cert_path),
                rejectUnauthorized: true,
            });
        }

        this.app = restify.createServer(serverOptions);
        this.remote = new SocketIo(this.app.server);

        this.remote.set('authorization', (handshakeData, callback) => {
            const request = handshakeData;

            const regex = /password=([\w0-9-]+)/g;
            const match = regex.exec(request);

            try {
                const password = match[1];
                if (this.config.houston_password) {
                    callback(null, this.config.houston_password === password);
                } else {
                    this.log.warn('Houston password not set.');
                }
            } catch (e) {
                this.notifyError(e);
            }
        });
    }

    async updateProfile() {
        const { identity } = this.config;
        const profileInfo = await this.blockchain.getProfile(this.config.node_wallet);
        if (!profileInfo.active) {
            this.log.info(`Profile hasn't been created for ${identity} yet`);
            return;
        }

        this.log.notify(`Profile is being updated for ${identity}. This could take a while...`);
        await this.blockchain.createProfile(
            this.config.identity,
            this.config.dh_price,
            this.config.dh_stake_factor,
            this.config.read_stake_factor,
            this.config.dh_max_time_mins,
        );

        this.log.notify('Profile successfully updated');
    }

    async connect() {
        this.app.listen(this.config.node_remote_control_port);
        await this.remote.on('connection', (socket) => {
            this.log.important('This is Houston. Roger. Out.');
            this.socket.initialize(socket);
            this.transport.getNetworkInfo().then((res) => {
                res.environment = process.env.NODE_ENV;
                socket.emit('system', { info: res });
                socket.emit('config', this.config); // TODO think about stripping some config values
            }).then((res) => {
                this.getImports();
            });

            this.socket.on('config-update', async (data) => {
                this.log.important(`Updating config.\n${JSON.stringify(data, null, 4)}`);
                deepExtend(this.config, data);
                await this.socket.emit('updateComplete');
            });

            this.socket.on('get-node-info', () => {
                socket.emit('nodeInfo', { version: pjson.version });
            });


            this.socket.on('get-imports', () => {
                this.getImports();
            });

            this.socket.on('get-visual-graph', (import_id) => {
                this.getImport(import_id);
            });

            this.socket.on('restart-node', () => {
                this.restartNode();
            });

            this.socket.on('set-me-as-bootstrap', () => {
                this.setMeAsBootstrap();
            });

            this.socket.on('set-bootstraps', (bootstrapNodes) => {
                this.setBootstraps(bootstrapNodes);
            });

            this.socket.on('get-balance', () => {
                this.getBalance();
            });

            this.socket.on('get-holding', () => {
                this.getHoldingData();
            });

            this.socket.on('get-replicated', () => {
                this.getReplicatedData();
            });

            this.socket.on('get-network-query-responses', (queryId) => {
                this.getNetworkQueryResponses(queryId);
            });

            this.socket.on('get-bids', () => {
                this.getPendingBids();
            });

            this.socket.on('get-local-data', (importId) => {
                this.getLocalData(importId);
            });

            this.socket.on('get-profile', () => {
                this.getProfile();
            });

            this.socket.on('get-total-payouts', () => {
                this.getTotalPayouts();
            });

            this.socket.on('payout', (offer_id) => {
                this.payOut(offer_id);
            });

            this.socket.on('get-stake-per-holding', (import_id) => {
                this.getStakedAmount(import_id);
            });

            this.socket.on('get-income-per-holding', (import_id) => {
                this.getHoldingIncome(import_id);
            });

            this.socket.on('get-local-query-responses', (datasetId) => {
                this.getLocalQueryResponses(datasetId);
            });

            this.socket.on('get-purchase-income', (data) => {
                this.getPurchaseIncome(data);
            });

            this.socket.on('get-offers', (datasetId) => {
                this.getOffers(datasetId);
            });
        });
    }

    updateConfigRow(data) {
        return new Promise((resolve, reject) => {
            Object.assign(this.config, data);
            // TODO: Save config here.
            resolve();
        });
    }

    /**
     * Update imports table from data_info
     */
    getImports() {
        return new Promise((resolve, reject) => {
            Models.data_info.findAll()
                .then((rows) => {
                    this.socket.emit('imports', rows);
                    resolve();
                });
        });
    }

    /**
     * Get offers by dataset ID
     */
    getOffers(datasetId) {
        return new Promise(async (resolve, reject) => {
            try {
                const offers = await Models.offers.findAll({
                    where: {
                        data_set_id: datasetId,
                    },
                });

                const filtered = offers.map(o => ({
                    replicationId: o.id,
                    datasetId: o.data_set_id,
                    offerId: o.offer_id,
                    holdingTimeInMinutes: o.holding_time_in_minutes,
                    tokenAmountPerHolder: o.token_amount_per_holder,
                    message: o.message,
                    transactionHash: o.transaction_hash,
                    litigationIntervalInMinutes: o.litigation_interval_in_minutes,
                    task: o.task,
                    status: o.status,
                    global_status: o.global_status,
                }));

                this.socket.emit('offers', {
                    datasetId,
                    offers: filtered,
                });

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Get graph by import_id
     * @import_id int
     */
    getImport(import_id) {
        return new Promise((resolve, reject) => {
            const verticesPromise = this.graphStorage.findVerticesByImportId(import_id);
            const edgesPromise = this.graphStorage.findEdgesByImportId(import_id);

            Promise.all([verticesPromise, edgesPromise]).then((values) => {
                var nodes = [];
                var edges = [];
                values[0].forEach((vertex) => {
                    const isRoot = !!((vertex._id === 'ot_vertices/Transport'
                        || vertex._id === 'ot_vertices/Transformation'
                        || vertex._id === 'ot_vertices/Product'
                        || vertex._id === 'ot_vertices/Ownership'
                        || vertex._id === 'ot_vertices/Observation'
                        || vertex._id === 'ot_vertices/Location'
                        || vertex._id === 'ot_vertices/Actor'
                    ));
                    const caption = (vertex.vertex_type === 'CLASS') ?
                        vertex._key : vertex.identifiers.uid;
                    nodes.push({
                        id: vertex._id,
                        type: caption,
                        caption,
                        root: isRoot,
                        data: vertex,
                    });
                });
                values[1].forEach((edge) => {
                    edges.push({
                        source: edge._from,
                        target: edge._to,
                        type: edge.edge_type,
                        caption: edge.edge_type,
                        github: edge,
                    });
                });

                this.socket.emit('visualise', { nodes, edges });
                resolve();
            });
        });
    }

    /**
     * Restarts the node
     */
    restartNode() {
        setTimeout(() => {
            process.on('exit', () => {
                /* eslint-disable-next-line */
                require('child_process').spawn(process.argv.shift(), process.argv, {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: 'inherit',
                });
            });
            process.exit(1);
        }, 2000);
    }

    /**
     * Set this node to be bootstrap node
     */
    setMeAsBootstrap() {
        this.config.is_bootstrap_node = true;
        // TODO: save storage.
        this.restartNode();
    }

    /**
     * Set bootstrap nodes
     * @param bootstrapNodes json
     */
    setBootstraps(bootstrapNodes) {
        this.config.network_bootstrap_nodes = bootstrapNodes;
        // TODO: save storage.
        this.restartNode();
    }

    /**
     * On completed bid
     * @return {Promise<void>}
     */
    async onCompletedBids() {
        await this.getHoldingData();
        await this.getPendingBids();
    }

    /**
     * Get holding data
     */
    async getHoldingData() {
        const bids = await Models.bids.findAll({
            where: {
                status: { [Models.Sequelize.Op.in]: ['COMPLETED', 'CHOSEN', 'PENALIZED'] },
            },
        });

        const aggregated = await map(
            bids,
            async (bid) => {
                const holding = await this._findHoldingByBid(bid);

                if (holding == null || holding.data_set_id == null) {
                    this.log.debug('Failed to get holding data for for bid %s.', bid);
                    return;
                }

                const dataInfo = await Models.data_info.findOne({
                    where: {
                        data_set_id: holding.data_set_id,
                    },
                });

                const paidAmount = await this.blockchain
                    .getHolderPaidAmount(bid.offer_id, this.config.erc725Identity);
                const stakedAmount = await this.blockchain
                    .getHolderStakedAmount(bid.offer_id, this.config.erc725Identity);

                return {
                    data_set_id: holding.data_set_id,
                    source_wallet: holding.source_wallet,
                    color: holding.color,
                    root_hash: dataInfo.root_hash,
                    paid_amount: paidAmount,
                    staked_amount: stakedAmount,
                    status: bid.status,
                    offer_id: bid.offer_id,
                };
            },
        );

        this.socket.emit('holding', aggregated);
    }

    /**
     * Finds holding based on a bid
     * @param bid
     * @return {Promise<Model>}
     */
    async _findHoldingByBid(bid) {
        const encryptionType = await this.blockchain
            .getHolderLitigationEncryptionType(bid.offer_id, this.config.erc725Identity);

        return Models.holding_data.findOne({
            where: {
                data_set_id: bid.data_set_id,
                color: encryptionType,
            },
        });
    }

    /**
     * Get replicated data
     */
    async getReplicatedData() {
        const replicated = await Models.replicated_data.findAll({
            where: {
                status: { [Models.Sequelize.Op.notIn]: ['STARTED', 'VERIFIED'] },
            },
        });

        const aggregated = await map(
            replicated,
            async (r) => {
                const offer = await Models.offers.findOne({
                    where: {
                        offer_id: r.offer_id,
                    },
                });
                return {
                    dh_id: r.dh_id,
                    data_set_id: offer.data_set_id,
                    status: r.status,
                    offer_id: r.offer_id,
                };
            },
        );

        this.socket.emit('replicated', aggregated);
    }

    /**
     * Notify offer status update
     * @param offerIdentifierObject
     */
    offerUpdate(offerIdentifierObject) {
        Models.offers.findOne({ where: offerIdentifierObject }).then((offerData) => {
            this.socket.emit('offerUpdate', {
                replicationId: offerData.id,
                offerId: offerData.offer_id,
                datasetId: offerData.data_set_id,
                holdingTimeInMinutes: offerData.holding_time_in_minutes,
                tokenAmountPerHolder: offerData.token_amount_per_holder,
                message: offerData.message,
                transactionHash: offerData.transaction_hash,
                litigationIntervalInMinutes: offerData.litigation_interval_in_minutes,
                task: offerData.task,
                status: offerData.status,
                global_status: offerData.global_status,
            });
        });
    }

    /**
     * Get bids data
     */
    async getPendingBids() {
        const bids = await Models.bids.findAll({
            where: {
                status: 'PENDING',
            },
        });
        this.socket.emit('bids', bids);
    }

    /**
     * Get local data
     */
    getLocalData(importId) {
        Models.data_info.findAll({
            where: {
                import_id: importId,
            },
        })
            .then((rows) => {
                this.socket.emit('localDataResponse', rows);
            }).catch((e) => {
                this.notifyError(e);
            });
    }

    /**
     * Get wallet balance
     * @param wallet
     */
    getBalance() {
        Utilities.getTracTokenBalance(
            this.web3, this.config.node_wallet,
            this.config.blockchain.token_contract_address,
        ).then((trac) => {
            this.socket.emit('trac_balance', trac);
        });
        this.web3.eth.getBalance(this.config.node_wallet).then((balance) => {
            this.socket.emit('balance', balance);
        });
    }

    /**
     * Get amount of tokens currently staked in a job
     */
    async getStakedAmount(import_id) {
        const stakedAmount = await this.blockchain.getStakedAmount(import_id);
        this.socket.emit('jobStake', { stakedAmount, import_id });
    }

    /**
     * Get payments for one data holding job
     */
    async getHoldingIncome(import_id) {
        const holdingIncome = await this.blockchain.getHoldingIncome(import_id);
        this.socket.emit('holdingIncome', { holdingIncome, import_id });
    }

    /**
     * Get payments for one data reading job
     */
    async getPurchaseIncome(data) {
        const DV_wallet = data.sourceWalletPerHolding;
        const import_id = data.importIdPerHolding;
        const stakedAmount = await this.blockchain.getPurchaseIncome(import_id, DV_wallet);
        this.socket.emit('purchaseIncome', { stakedAmount, import_id, DV_wallet });
    }

    /**
     * Get profile
     */
    async getProfile() {
        const profile = await this.blockchain.getProfile(this.config.erc725Identity);
        this.socket.emit('profile', profile);
    }

    /**
     * Get total payments - earning in total
     */
    async getTotalPayouts() {
        const totalAmount = await this.blockchain.getTotalPayouts(this.config.erc725Identity);
        this.socket.emit('total_payouts', totalAmount);
    }

    /**
     * Payout offer
     * @param offerId
     * @returns {Promise<void>}
     */
    async payOut(offerId) {
        await this.profileService.payOut(offerId);
        this.socket.emit('payout_initiated', offerId);
    }

    /**
     * Get network query responses
     */
    getNetworkQueryResponses(queryId) {
        Models.network_query_responses.findAll({
            where: {
                query_id: queryId,
            },
        })
            .then((rows) => {
                if (rows.length > 0) {
                    this.socket.emit('networkQueryResponses', rows);
                }
            }).catch((e) => {
                this.notifyError(e);
            });
    }

    /**
     * Get import request data
     */
    importRequestData() {
        const message = '[DC] Import complete';
        this.socket.emit('importRequestData', message);
    }

    getLocalQueryResponses(datasetId) {
        Models.data_info.findAll({
            where: {
                data_set_id: datasetId,
            },
        })
            .then((rows) => {
                this.socket.emit('localDataResponses', rows);
            }).catch((e) => {
                this.notifyError(e);
            });
    }

    /**
     * Get import data error
     */
    importFailed(data) {
        this.socket.emit('importFailed', data);
    }

    /**
     * Get import data - succeeded
     */
    importSucceeded(data) {
        this.socket.emit('importSucceeded', data);
    }


    /**
     * Emmit collected offers for ODN Search
     */
    networkQueryOffersCollected() {
        this.socket.emit('networkQueryOffersCollected');
    }

    noOffersForQuery(data) {
        this.socket.emit('noOffersForQuery', data);
    }


    /**
     * Deposit tokens - succeeded
     * @param data
     */
    tokenDepositSucceeded(data) {
        this.socket.emit('tokenDepositSucceeded', data);
    }
    /**
     * Deposit tokens - failed
     * @param data
     */
    tokensDepositFailed(data) {
        this.socket.emit('tokensDepositFailed', data);
    }

    /**
     * Withdraw tokens - succeeded
     * @param data
     */
    tokensWithdrawSucceeded(data) {
        this.socket.emit('tokensWithdrawSucceeded', data);
    }

    /**
     * Withdraw tokens - failed
     * @param data
     */
    tokensWithdrawFailed(data) {
        this.socket.emit('tokensWithdrawFailed', data);
    }

    /**
     * DV events
     */
    networkQueryOfferArrived(data) {
        this.socket.emit('networkQueryOfferArrived', data);
    }

    purchaseFinished(data, importId) {
        this.socket.emit('purchaseFinished', { data, importId });
    }

    answerNotFound(data) {
        this.socket.emit('answerNotFound', data);
    }


    /**
     * DH events
     */

    replicationVerificationStatus(data) {
        this.socket.emit('replicationVerificationStatus', data);
    }

    bidNotTaken(data) {
        this.socket.emit('bidNotTaken', data);
    }

    replicationRequestSent(importId) {
        const message = `Replication request send for ${importId}`;
        this.socket.emit('replicationRequestSent', message);
    }

    replicationReqestFailed(data) {
        this.socket.emit('replicationReqestFailed', data);
    }

    sendingRootHashes(data) {
        this.socket.emit('sendingRootHashes', data);
    }

    dhReplicationFinished(data) {
        this.socket.emit('dhReplicationFinished', data);
    }

    failedOfferHandle(data) {
        this.socket.emit('failedOfferHandle', data);
    }


    /**
     * DC events
     */
    failedToCreateOffer(data) {
        this.socket.emit('failedToCreateOffer', data);
    }

    /**
     * DC events
     */
    failedToFinalizeOffer(data) {
        this.socket.emit('failedToFinalizeOffer', data);
    }

    writingRootHash(importId) {
        this.socket.emit('writingRootHash', importId);
    }

    fingerprintWritten(message, importId) {
        this.socket.emit('fingerprintWritten', { message, importId });
    }

    initializingOffer(importId) {
        this.socket.emit('initializingOffer', importId);
    }
    cancelingOffer(data, importId) {
        this.socket.emit('cancelingOffer', { data, importId });
    }

    biddingStarted(importId) {
        const message = 'Offer written to blockchain. Started bidding phase.';
        this.socket.emit('biddingStarted', { message, importId });
    }

    biddingComplete(importId) {
        this.socket.emit('biddingComplete', importId);
    }

    addingBid(data) {
        this.socket.emit('addingBid', data);
    }

    choosingBids(importId) {
        this.socket.emit('choosingBids', importId);
    }

    bidChosen(importId) {
        this.socket.emit('bidChosen', importId);
    }

    dcErrorHandling(error) {
        this.socket.emit('dcErrorHandling', error);
    }

    offerFinalized(data, importId) {
        this.socket.emit('offerFinalized', { data, importId });
    }

    challengeFailed(data) {
        this.socket.emit('challengeFailed', data);
    }

    offerInitiated(data) {
        this.socket.emit('offerInitiated', data);
    }

    readNotification(data) {
        this.socket.emit('readNotification', data);
    }

    offerCanceled(data, importId) {
        this.socket.emit('offerCanceled', { data, importId });
    }

    importError(data) {
        this.socket.emit('errorImport', data);
    }
}

module.exports = RemoteControl;
