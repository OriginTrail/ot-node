const config = require('./Config');
const app = require('http').createServer();
const remote = require('socket.io')(app);
const node = require('./Node');
const Models = require('../models');
const kadence = require('@kadenceproject/kadence');
const pjson = require('../package.json');
const Storage = require('./Storage');

class RemoteControl {
    static async connect() {
        this.node = node.ot;
        app.listen(config.remote_control_port);
        await remote.on('connection', (socket) => {
            this.socket = socket;
            RemoteControl.getProtocolInfo().then((res) => {
                socket.emit('system', { info: res });
                var config = {};
                Models.node_config.findAll()
                    .then((rows) => {
                        rows.forEach((row) => {
                            config[row.key] = row.value;
                        });
                        socket.emit('config', config);
                    });
            });

            this.socket.on('config-update', (data) => {
                for (var key in data) {
                    Storage.db.query('UPDATE node_config SET value = ? WHERE key = ?', {
                        replacements: [data[key], key],
                    }).then((res) => {
                        setTimeout(() => {
                            process.on('exit', () => {
                                /* eslint-disable-next-line */
                                require('child_process').spawn(process.argv.shift(), process.argv, {
                                    cwd: process.cwd(),
                                    detached: true,
                                    stdio: 'inherit',
                                });
                            });
                            process.exit();
                        }, 5000);
                    }).catch((err) => {
                        console.log(err);
                    });
                }
            });

            this.socket.on('get-imports', (data) => {
                RemoteControl.getListOfImports();
            });
        });
    }

    /**
     * Returns basic information about the running node
     * @param {Control~getProtocolInfoCallback} callback
     */
    static getProtocolInfo() {
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
   * Gets the list of all imports
   */
    static getListOfImports() {
        return new Promise((resolve, reject) => {
            Models.data_info.findAll()
                .then((rows) => {
                    this.socket.emit('imports', rows);
                    resolve();
                });
        });
    }
}

module.exports = RemoteControl;
