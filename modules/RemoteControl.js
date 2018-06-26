const config = require('./Config');
const app = require('http').createServer();
const remote = require('socket.io')(app);
const Models = require('../models');
const kadence = require('@kadenceproject/kadence');
const pjson = require('../package.json');
const Storage = require('./Storage');


class RemoteControl {
    constructor(ctx) {
        this.network = ctx.network;
        this.graphStorage = ctx.graphStorage;
    }

    async connect() {
        this.node = this.network.kademlia();
        app.listen(config.remote_control_port);
        await remote.on('connection', (socket) => {
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
                for (var key in data) {
                    Storage.db.query('UPDATE node_config SET value = ? WHERE key = ?', {
                        replacements: [data[key], key],
                    }).then((res) => {
                        this.restartNode();
                    }).catch((err) => {
                        console.log(err);
                    });
                }
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
            process.exit(2);
        }, 5000);
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
}

module.exports = RemoteControl;
