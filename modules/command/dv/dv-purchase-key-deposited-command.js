const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const constants = require('../../constants');

/**
 * Handles data location response.
 */
class DvPurchaseKeyDepositedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.remoteControl = ctx.remoteControl;
        this.transport = ctx.transport;
        this.blockchain = ctx.blockchain;
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.graphStorage = ctx.graphStorage;
        this.permissionedDataService = ctx.permissionedDataService;
        this.profileService = ctx.profileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            handler_id,
            blockchain_id,
            encoded_data,
            purchase_id,
            permissioned_data_array_length,
            permissioned_data_original_length,
            permissioned_data_root_hash,
        } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'KeyDeposited',
                finished: 0,
            },
        });
        if (events && events.length > 0) {
            const event = events.find((e) => {
                const {
                    purchaseId,
                } = JSON.parse(e.data);
                return purchaseId === purchase_id;
            });
            if (event) {
                event.finished = 1;
                await event.save({ fields: ['finished'] });
                this.logger.important(`Purchase ${purchase_id} confirmed by seller. Decoding data from submitted key.`);
                this.remoteControl.purchaseStatus('Purchase confirmed', 'Validating and storing data on your local node.');
                const { key } = JSON.parse(event.data);

                const decoded_data = this.permissionedDataService.decodePermissionedData(
                    encoded_data,
                    key,
                );

                const validationResult = this.permissionedDataService.validatePermissionedDataTree(
                    decoded_data,
                    permissioned_data_array_length,
                );

                const rootIsValid = this.permissionedDataService.validatePermissionedDataRoot(
                    decoded_data,
                    permissioned_data_root_hash,
                );

                if (validationResult.error || !rootIsValid) {
                    let errorMessage;

                    if (validationResult.error) {
                        command.data.input_index_left = validationResult.inputIndexLeft;
                        command.data.output_index = validationResult.outputIndex;
                        command.data.error_type = constants.PURCHASE_ERROR_TYPE.NODE_ERROR;
                        errorMessage = 'Detected error in permissioned data merkle tree.';
                    } else if (!rootIsValid) {
                        command.data.error_type = constants.PURCHASE_ERROR_TYPE.ROOT_ERROR;
                        errorMessage = 'Detected error in permissioned data decoded root hash.';
                    }

                    await this._handleError(
                        handler_id,
                        purchase_id,
                        errorMessage,
                    );

                    command.data.key = key;
                    await this.commandExecutor.add({
                        name: 'dvPurchaseDisputeCommand',
                        data: command.data,
                    });
                    return Command.empty();
                }

                const reconstructedPermissionedData = this.permissionedDataService
                    .reconstructPermissionedData(
                        decoded_data,
                        permissioned_data_array_length,
                        permissioned_data_original_length,
                    );

                const handler = await Models.handler_ids.findOne({
                    where: {
                        handler_id,
                    },
                });

                const {
                    data_set_id,
                    ot_object_id,
                } = JSON.parse(handler.dataValues.data);

                await this.permissionedDataService.updatePermissionedDataInDb(
                    data_set_id,
                    ot_object_id,
                    reconstructedPermissionedData,
                );

                handler.status = 'COMPLETED';
                await handler.save({ fields: ['status'] });

                await Models.data_trades.update(
                    {
                        status: 'COMPLETED',
                    },
                    {
                        where: {
                            purchase_id,
                        },
                    },
                );

                const allBlockchainIds = this.blockchain.getAllBlockchainIds();

                const data_info =
                    await Models.data_info.findOne({ where: { data_set_id } });
                const data_provier_wallets = JSON.parse(data_info.dataValues.data_provider_wallets);
                let promises = [];
                for (const provider_element of data_provier_wallets) {
                    if (allBlockchainIds.includes(provider_element.blockchain_id)) {
                        promises.push(this.blockchain
                            .getRootHash(data_set_id, provider_element.blockchain_id).response
                            .then(res => ({
                                blockchain_id: provider_element.blockchain_id,
                                root_hash: res,
                            })));
                    }
                }

                const allRootHashes = await Promise.all(promises);
                const validBlockchainIds = [];
                for (const response of allRootHashes) {
                    const { root_hash } = response;
                    if (root_hash && !Utilities.isZeroHash(root_hash)
                        && Utilities.compareHexStrings(root_hash, data_info.root_hash)) {
                        validBlockchainIds.push(response.blockchain_id);
                    }
                }

                const prices = [];
                const identities = [];
                promises = [];
                for (const bc_id of validBlockchainIds) {
                    const identity = this.profileService.getIdentity(bc_id);
                    prices.push({
                        blockchain_id: bc_id,
                        price_in_trac: this.config.default_data_price,
                    });
                    identities.push({
                        blockchain_id: bc_id,
                        identity,
                    });
                    promises.push(Models.data_sellers.create({
                        data_set_id,
                        blockchain_id: bc_id,
                        ot_json_object_id: ot_object_id,
                        seller_node_id: this.config.identity,
                        seller_erc_id: identity,
                        price: this.config.default_data_price,
                    }));
                }
                this.logger.important(`Purchase ${purchase_id} completed. Data stored successfully`);
                this.remoteControl.purchaseStatus('Purchase completed', 'You can preview the purchased data in My Purchases page.');

                const { node_wallet, node_private_key } =
                    this.blockchain.getWallet(blockchain_id).response;

                const purchaseCompletionObject = {
                    message: {
                        purchase_id,
                        blockchain_id,
                        data_set_id,
                        ot_object_id,
                        seller_node_id: this.config.identity,
                        seller_erc_ids: identities,
                        wallet: node_wallet,
                        prices,
                    },
                };

                purchaseCompletionObject.messageSignature =
                    Utilities.generateRsvSignature(
                        purchaseCompletionObject.message,
                        node_private_key,
                    );

                await this.transport.publish('kad-purchase-complete', purchaseCompletionObject);
                this.logger.info('Published purchase confirmation on the network.');

                return Command.empty();
            }
        }
        if (command.retries === 0) {
            await this._handleError(
                handler_id,
                purchase_id,
                'Couldn\'t find KeyDeposited event on blockchain.',
            );
            return Command.empty();
        }
        return Command.retry();
    }

    async recover(command, err) {
        const { handler_id, purchase_id } = command.data;

        await this._handleError(handler_id, purchase_id, err);

        return Command.empty();
    }

    async _handleError(handler_id, purchase_id, errorMessage) {
        this.logger.error(`Error occured in dvPurchaseKeyDepositedCommand. Reason given: ${errorMessage}`);
        await Models.data_trades.update({
            status: 'FAILED',
        }, {
            where: {
                purchase_id,
            },
        });

        await Models.handler_ids.update({
            data: JSON.stringify({ message: errorMessage }),
            status: 'FAILED',
        }, { where: { handler_id } });
    }

    /**
     * Builds default DvPurchaseKeyDepositedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseKeyDepositedCommand',
            delay: 1 * 60 * 1000, // 5 min todo update to 5 min
            transactional: false,
            retries: 3,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvPurchaseKeyDepositedCommand;
