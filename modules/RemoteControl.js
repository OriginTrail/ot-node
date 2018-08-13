const config = require('./Config');
const app = require('http').createServer();
const remote = require('socket.io')(app);
const Models = require('../models');
const kadence = require('@kadenceproject/kadence');
const pjson = require('../package.json');
const Storage = require('./Storage');
const Web3 = require('web3');
const Utilities = require('./Utilities');

const web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt'));

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
        this.network = ctx.network;
        this.graphStorage = ctx.graphStorage;
        this.blockchain = ctx.blockchain;
        this.log = ctx.logger;
        this.config = ctx.config;
        this.web3 = ctx.web3;
        this.socket = new SocketDecorator(ctx.logger);
        this.notifyError = ctx.notifyError;


        remote.set('authorization', (handshakeData, callback) => {
            const request = handshakeData;

            const regex = /password=([\w0-9-]+)/g;
            const match = regex.exec(request);

            try {
                const password = match[1];
                Models.node_config.findOne({ where: { key: 'houston_password' } }).then((res) => {
                    callback(null, res.value === password);
                });
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
        this.node = this.network.kademlia();
        app.listen(config.remote_control_port);
        await remote.on('connection', (socket) => {
            this.log.important('This is Houston. Roger. Out.');
            this.socket.initialize(socket);
            this.getProtocolInfo().then((res) => {
                socket.emit('system', { info: res });
                var config = {};
                Models.node_config.findAll()
                    .then((rows) => {
                        rows.forEach((row) => {
                            config[row.key] = row.value;
                        });
                        socket.emit('config', config);
                    });
            }).then((res) => {
                this.updateImports();
            });

            this.socket.on('config-update', (data) => {
                this.updateConfigRow(data).then(async (res) => {
                    await this.updateProfile();
                    this.restartNode();
                    await this.socket.emit('updateComplete');
                });
            });

            this.socket.on('get-imports', () => {
                this.updateImports();
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
                this.getBids();
            });

            this.socket.on('get-local-data', (importId) => {
                this.getLocalData(importId);
            });

            this.socket.on('get-total-stake', () => {
                this.getTotalStakedAmount();
            });

            this.socket.on('get-total-income', () => {
                this.getTotalIncome();
            });

            this.socket.on('payout', (import_id) => {
                this.payOut(import_id);
            });

            this.socket.on('get-stake-per-holding', (import_id) => {
                this.getStakedAmount(import_id);
            });

            this.socket.on('get-income-per-holding', (import_id) => {
                this.getHoldingIncome(import_id);
            });

            this.socket.on('get-local-query-responses', (importId) => {
                this.getLocalQueryResponses(importId);
            });

            this.socket.on('get-purchase-income', (data) => {
                this.getPurchaseIncome(data);
            });
        });
    }

    /**
     * Returns basic information about the running node
     * @param {Control~getProtocolInfoCallback} callback
     */
    getProtocolInfo() {
        return new Promise((resolve, reject) => {
            const peers = [];
            const dump = this.node.router.getClosestContactsToKey(
                this.node.identity,
                kadence.constants.K * kadence.constants.B,
            );

            for (const peer of dump) {
                peers.push(peer);
            }

            resolve({
                versions: pjson.version,
                identity: this.node.identity.toString('hex'),
                contact: this.node.contact,
                peers,
            });
        });
    }
    updateConfigRow(data) {
        return new Promise((resolve, reject) => {
            for (var key in data) {
                const query = `UPDATE node_config SET value = '${data[key]}' WHERE key = '${key}';`;
                Storage.db.query(query).then((res) => {

                });
            }
            resolve();
        });
    }

    /**
     * Update imports table from data_info
     */
    updateImports() {
        return new Promise((resolve, reject) => {
            Models.data_info.findAll()
                .then((rows) => {
                    this.socket.emit('imports', rows);
                    resolve();
                });
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
        Models.node_config.update({
            value: '[]',
        }, {
            where: {
                key: 'network_bootstrap_nodes',
            },
        }).then(() => {
            this.restartNode();
        });
    }

    /**
     * Set bootstrap nodes
     * @param bootstrapNodes json
     */
    setBootstraps(bootstrapNodes) {
        Models.node_config.update({
            value: JSON.parse(bootstrapNodes),
        }, {
            where: {
                key: 'network_bootstrap_nodes',
            },
        }).then(() => {
            this.restartNode();
        });
    }

    /**
     * Get holding data
     */
    getHoldingData() {
        Models.holding_data.findAll()
            .then((rows) => {
                this.socket.emit('holding', rows);
            });
    }

    /**
     * Get replicated data
     */
    getReplicatedData() {
        Models.replicated_data.findAll()
            .then((rows) => {
                this.socket.emit('replicated', rows);
            });
    }

    /**
     * Get bids data
     */
    getBids() {
        Models.bids.findAll()
            .then((rows) => {
                this.socket.emit('bids', rows);
            });
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
        Utilities.getAlphaTracTokenBalance(
            this.web3, process.env.NODE_WALLET,
            this.config.blockchain.token_contract_address,
        ).then((trac) => {
            this.socket.emit('trac_balance', trac);
        });
        web3.eth.getBalance(process.env.NODE_WALLET).then((balance) => {
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
     * Get total staked amount of tokens - staked in total
     */
    async getTotalStakedAmount() {
        const stakedAmount = await this.blockchain.getTotalStakedAmount();
        this.socket.emit('total_stake', stakedAmount);
    }

    /**
     * Get total payments - earning in total
     */
    async getTotalIncome() {
        const stakedAmount = await this.blockchain.getTotalIncome();
        this.socket.emit('total_income', stakedAmount);
    }

    /**
     * Payout offer
     * @param import_id
     * @returns {Promise<void>}
     */
    async payOut(import_id) {
        await this.blockchain.payOut(import_id);
        this.socket.emit('payout_complete', import_id);
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

    getLocalQueryResponses(importId) {
        Models.data_info.findAll({
            where: {
                import_id: importId,
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

    writingRootHash(importId) {
        this.socket.emit('writingRootHash', importId);
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
}

module.exports = RemoteControl;
