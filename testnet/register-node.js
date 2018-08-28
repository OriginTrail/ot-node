require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const axios = require('axios');
const envfile = require('envfile');
const ip = require('ip');
const fs = require('fs');

const socket = require('socket.io-client')('wss://station.origintrail.io:3010');

const Web3 = require('web3');

const web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt'));

const Umzug = require('umzug');

const Models = require('../models');

const umzug_migrations = new Umzug({

    storage: 'sequelize',

    storageOptions: {
        sequelize: Models.sequelize,
    },

    migrations: {
        params: [Models.sequelize.getQueryInterface(), Models.sequelize.constructor, () => {
            throw new Error('Migration tried to use old style "done" callback. Please upgrade to "umzug" and return a promise instead.');
        }],
        path: './migrations',
        pattern: /\.js$/,
    },

});

const umzug_seeders = new Umzug({

    storage: 'sequelize',

    storageOptions: {
        sequelize: Models.sequelize,
        modelName: 'SeedsMeta',
        tableName: 'SeedsMeta',
    },

    migrations: {
        params: [Models.sequelize.getQueryInterface(), Models.sequelize.constructor, () => {
            throw new Error('Migration tried to use old style "done" callback. Please upgrade to "umzug" and return a promise instead.');
        }],
        path: './seeders',
        pattern: /\.js$/,
    },

});

class RegisterNode {
    constructor() {
        this.setConfig().then((result) => {
            web3.eth.getBalance(process.env.NODE_WALLET).then((balance) => {
                if (balance <= 0) {
                    this.registerNode(result.ip, result.wallet);
                } else {
                    this.runNode();
                }
            });
        });
    }

    socketSend(wallet, nodeIp) {
        console.log('Entering sockets...');
        socket.emit('presence', { walletAddress: wallet, ipAddress: nodeIp, connected: true });
        // socket.on('connect', () => {
        // socket.emit('presence', { walletAddress: wallet, ipAddress: nodeIp, connected: true });
        // });
    }

    generateWallet() {
        return new Promise(async (resolve, reject) => {
            const account = await web3.eth.accounts.create();
            resolve({ wallet: account.address, pk: account.privateKey.substr(2) });
        });
    }

    async makeid() {
        var text = '';
        var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (var i = 0; i < 10; i += 1) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    registerNode(ip, wallet) {
        console.log(ip, wallet);
        axios.post('https://station.origintrail.io/api/node/register', {
            ip, wallet,
        }).then((result) => {
            console.log(result.data);
            let counter = 0;
            const checkBalanceInterval = setInterval(() => {
                web3.eth.getBalance(process.env.NODE_WALLET).then((balance) => {
                    if (balance > 0) {
                        clearInterval(checkBalanceInterval);
                        this.runNode();
                    } else {
                        counter += 1;
                        console.log(`Counting ${counter}`);
                        if (counter > 20) {
                            process.kill(3);
                        }
                    }
                });
            }, 20000);
        }).catch((e) => {
            console.log(e);
            process.kill(3);
        });
    }

    setConfig() {
        return new Promise(async (resolve, reject) => {
            const env = envfile.parseFileSync('.env');
            if (!env.NODE_WALLET) {
                const { wallet, pk } = await this.generateWallet();
                env.NODE_WALLET = wallet;
                env.NODE_PRIVATE_KEY = pk;
            }

            if (process.env.INSTALLATION === 'local') {
                env.NODE_IP = '127.0.0.1'; // TODO remove
            } else {
                env.NODE_IP = ip.address();
            }

            env.DB_PASSWORD = 'root';
            env.BOOTSTRAP_NODE = 'https://188.166.3.182:5278/#2fee0c13ad5d2e4a6a90ce9f20a07720edbd0a41';

            for (const prop in env) {
                if (Object.prototype.hasOwnProperty.call(env, prop)) {
                    process.env[prop] = env[prop];
                }
            }

            const envF = envfile.stringifySync(env);
            console.log(envF);

            fs.writeFile('.env', envF, (err) => {
                if (fs.existsSync('modules/Database/system.db')) {
                    if (process.env.UPDATE !== undefined) {
                        umzug_seeders.down({ to: 0 }).then((migrations) => {
                            Models.sequelize.query('delete from sqlite_sequence where name=\'node_config\';');
                            Models.sequelize.query('delete from sqlite_sequence where name=\'blockchain_data\';');
                            Models.sequelize.query('delete from sqlite_sequence where name=\'graph_database\';');
                            umzug_seeders.up().then((migrations) => {
                                console.log('Configuration loaded...');
                                resolve({
                                    ip: env.NODE_IP,
                                    wallet: env.NODE_WALLET,
                                });
                            });
                        });
                    } else {
                        console.log('Configuration not changed...');
                        resolve({
                            ip: env.NODE_IP,
                            wallet: env.NODE_WALLET,
                        });
                    }
                } else {
                    umzug_migrations.up().then((migrations) => {
                        umzug_seeders.up().then((migrations) => {
                            console.log('Configuration loaded...');
                            resolve({
                                ip: env.NODE_IP,
                                wallet: env.NODE_WALLET,
                            });
                        });
                    });
                }
            });
        });
    }

    runNode() {
        const nodeIp = process.env.NODE_IP;
        const wallet = process.env.NODE_WALLET;
        this.socketSend(wallet, nodeIp);
        // eslint-disable-next-line
        require('../ot-node');
    }
}
// eslint-disable-next-line no-new
(new RegisterNode());

