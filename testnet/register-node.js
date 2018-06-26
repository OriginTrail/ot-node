require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const axios = require('axios');
const envfile = require('envfile');
const externalip = require('externalip');
const fs = require('fs');

const socket = require('socket.io-client')('http://18.185.39.223:3010');

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
        this.generateWallet().then((result) => {
            this.registerNode(result.ip, result.wallet);
        });
    }

    socketSend(wallet, nodeIp) {
        console.log('Entering sockets....!');
        socket.on('connect', () => {
            socket.emit('presence', { walletAddress: wallet, ipAddress: nodeIp, connected: true });
        });
    }

    generateWallet() {
        return new Promise(async (resolve, reject) => {
            const env = envfile.parseFileSync('.env');
            if (!env.NODE_WALLET) {
                const account = await web3.eth.accounts.create();
                env.NODE_WALLET = account.address;
                env.NODE_PRIVATE_KEY = account.privateKey.substr(2);
                env.NODE_IP = await this.getExternalIp();
                env.DB_PASSWORD = 'root';

                process.env.NODE_WALLET = account.address;
                process.env.NODE_PRIVATE_KEY = account.privateKey.substr(2);
                process.env.NODE_IP = env.NODE_IP;
                process.env.DB_PASSWORD = 'root';

                const envF = envfile.stringifySync(env);
                console.log(envF);

                fs.writeFile('.env', envF, (err) => {
                    umzug_migrations.up().then((migrations) => {
                        umzug_seeders.up().then((migrations) => {
                            console.log('Configuration loaded...');
                            resolve({
                                ip: env.NODE_IP,
                                wallet: env.NODE_WALLET,
                            });
                        });
                    });
                });
            } else {
                this.runNode();
            }
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
            // console.log(result.data);
            const checkBalanceInterval = setInterval(() => {
                web3.eth.getBalance(process.env.NODE_WALLET).then((balance) => {
                    if (balance > 0) {
                        clearInterval(checkBalanceInterval);
                        this.runNode();
                    }
                });
            }, 20000);
        }).catch((e) => {
            console.log(e);
        });
    }

    runNode() {
        const nodeIp = process.env.NODE_IP;
        const wallet = process.env.NODE_WALLET;
        this.socketSend(wallet, nodeIp);
        // eslint-disable-next-line
        require('../ot-node');
    }

    getExternalIp() {
        return new Promise((resolve, reject) => {
            externalip((err, ip) => {
                if (err) {
                    console.log(err);
                }
                resolve(ip);
            });
        });
    }
}
// eslint-disable-next-line no-new
(new RegisterNode());

