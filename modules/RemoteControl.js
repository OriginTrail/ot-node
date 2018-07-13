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


class RemoteControl {
    constructor(ctx) {
        this.network = ctx.network;
        this.graphStorage = ctx.graphStorage;
        this.blockchain = ctx.blockchain;
        this.log = ctx.logger;
        this.config = ctx.config;
        this.web3 = ctx.web3;


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
                this.log.trace('Wrong pass');
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
            this.socket = socket;
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
                let query = '';
                for (var key in data) {
                    query += `UPDATE node_config SET value = '${data[key]}' WHERE key = '${key}';`;
                }
                Storage.db.query(query).then(async (res) => {
                    await this.updateProfile();
                    this.socket.emit('update-complete');
                    this.restartNode();
                }).catch((err) => {
                    console.log(err);
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
     * Get network query responses
     */
    getNetworkQueryResponses(queryId) {
        const interval = setInterval(() => {
            Models.network_query_responses.findAll({
                where: {
                    query_id: queryId,
                },
            })
                .then((rows) => {
                    console.log(rows);
                    if (rows.length > 0) {
                        this.socket.emit('networkQueryResponses', rows);
                        clearInterval(interval);
                    }
                }).catch((e) => {

                });
        }, 15000);
    }
}

module.exports = RemoteControl;
