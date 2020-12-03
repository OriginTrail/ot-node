const Models = require('../../../models/index');
const Command = require('../command');

const { Op } = Models.Sequelize;

const BN = require('bn.js');
const Utilities = require('../../Utilities');

/**
 * Saves generated parameters to the DB
 */
class DHReadDataLocationRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.config = ctx.config;
        this.transport = ctx.transport;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            msgNodeId, msgWallet, msgQuery, msgId,
        } = command.data;

        const my_node_wallets = this.blockchain.getAllWallets().map(elem => ({
            blockchain_id: elem.blockchain_id,
            node_wallet: elem.response.node_wallet,
            node_private_key: elem.response.node_private_key,
        }));

        // Check if mine publish.
        if (msgNodeId === this.config.identity && this._isMyWallet(msgWallet, my_node_wallets)) {
            this.logger.trace('Received mine publish. Ignoring.');
            return Command.empty();
        }

        // Handle query here.
        const graphImportDetails = await this.graphStorage.dataLocationQuery(msgQuery);
        let graphImports = [];
        graphImportDetails.forEach((item) => {
            const { datasets } = item;
            graphImports = graphImports.concat(datasets.filter(x => graphImports.indexOf(x) < 0));
        });

        // Filter imports not stored in local DB.
        const imports = await Models.data_info.findAll({
            attributes: ['data_set_id', 'data_provider_wallets', 'root_hash', 'origin', 'otjson_size_in_bytes'],
            where: {
                data_set_id: {
                    [Op.in]: graphImports,
                },
            },
        });

        if (!imports || imports.length === 0) {
            // I don't want to participate
            this.logger.trace(`No imports found for request ${msgId}`);
            return Command.empty();
        }

        const validImports = [];
        const fingerprintData = {};
        for (let i = 0; i < imports.length; i += 1) {
            const data_provider_wallets = JSON.parse(imports[i].data_provider_wallets);

            const { data_set_id: dataset_id, root_hash, origin } = imports[i];

            // Check where did the dataset come from
            //  -> If it's imported make sure that it was replicated on the network
            if (origin === 'IMPORTED') {
                // eslint-disable-next-line no-await-in-loop
                const offers = await Models.offers.findAll({
                    attributes: ['offer_id', 'blockchain_id'],
                    where: {
                        data_set_id: imports[i].data_set_id,
                    },
                });

                if (Array.isArray(offers) && offers.length > 0) {
                    validImports.push(dataset_id);
                    // eslint-disable-next-line no-await-in-loop
                    fingerprintData[dataset_id] = await this
                        ._getFingerprintData(dataset_id, root_hash, data_provider_wallets);
                }
            } else {
                validImports.push(dataset_id);
                // eslint-disable-next-line no-await-in-loop
                fingerprintData[dataset_id] = await this
                    ._getFingerprintData(dataset_id, root_hash, data_provider_wallets);
            }
        }

        const dataPrice = 100000; // TODO add to configuration

        let size = 0;
        const importObjects = validImports.map((dataset_id) => {
            size = imports.find(di => di.data_set_id === dataset_id).otjson_size_in_bytes;

            const importDetails = graphImportDetails
                .filter(x => x.datasets.indexOf(dataset_id) >= 0);
            const permissionedData = [];

            importDetails.forEach((item) => {
                if (item.hasPermissionedData && item.permissionedDataAvailable) {
                    permissionedData.push({
                        ot_object_id: item.id,
                    });
                }
            });

            const importObject = {
                data_set_id: dataset_id,
                size,
                calculated_price: new BN(size, 10).mul(new BN(dataPrice, 10)).toString(),
                fingerprint_data: fingerprintData[dataset_id],
            };


            if (permissionedData.length > 0) {
                importObject.permissioned_data = permissionedData;
            }

            return importObject;
        });

        if (importObjects.length === 0) {
            this.logger.trace(`Didn't find imports for query ${JSON.stringify(msgQuery)}.`);
            return Command.empty();
        }

        const networkReplyModel = await Models.network_replies.create({
            data: {
                id: msgId,
                imports: importObjects,
                dataPrice,
                stakeFactor: this.config.read_stake_factor,
            },
            receiver_wallet: msgWallet,
            receiver_identity: msgNodeId,
        });

        if (!networkReplyModel) {
            this.logger.error('Failed to create new network reply model.');
            throw Error('Internal error.');
        }

        const { node_wallet, node_private_key } = my_node_wallets[0];
        const nodeId = this.config.identity;

        const messageResponse = {
            id: msgId,
            replyId: networkReplyModel.id,
            wallet: node_wallet,
            nodeId,
            imports: importObjects,
            dataPrice,
            dataSize: size,
            stakeFactor: this.config.read_stake_factor,
        };

        const messageResponseSignature =
            Utilities.generateRsvSignature(
                messageResponse,
                node_private_key,
            );

        const dataLocationResponseObject = {
            message: messageResponse,
            messageSignature: messageResponseSignature,
        };

        await this.transport.sendDataLocationResponse(
            dataLocationResponseObject,
            msgNodeId,
        );
        return Command.empty();
    }

    _isMyWallet(wallet, myWalletArray) {
        return !!myWalletArray
            .find(elem => elem.node_wallet.toLowerCase() === wallet.toLowerCase());
    }

    async _getFingerprintData(dataset_id, root_hash, data_provider_wallets) {
        const fingerprint_data = [];

        for (const wallet_data of data_provider_wallets) {
            const { blockchain_id } = wallet_data;
            const fingerprintObject = { blockchain_id };
            try {
                // eslint-disable-next-line no-await-in-loop
                const fingerprint = await this.blockchain
                    .getRootHash(dataset_id, blockchain_id).response;

                if (fingerprint && !Utilities.isZeroHash(fingerprint)
                     && Utilities.compareHexStrings(fingerprint, root_hash)) {
                    // Fingerprint matches, write root hash
                    fingerprintObject.root_hash = root_hash;
                } else if (fingerprint && !Utilities.isZeroHash(fingerprint)) {
                    // Fingerprint doesn't match, write different hashes in error message
                    fingerprintObject.message = 'Root hash does not match. ' +
                        `Found ${fingerprint} on blockchain but expected ${root_hash} based on imported dataset`;
                } else {
                    // Fingerprint is empty
                    fingerprintObject.message = 'Root hash does not match. ' +
                        `Found empty hash on blockchain but expected ${root_hash} based on imported dataset`;
                }
            } catch (error) {
                fingerprintObject.message = `Could not get root hash from blockchain. ${error.toString()}`;
            }

            fingerprint_data.push(fingerprintObject);
        }

        return fingerprint_data;
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhReadDataLocationRequestCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHReadDataLocationRequestCommand;
