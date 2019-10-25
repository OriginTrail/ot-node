const bytes = require('utf8-length');

const Models = require('../../../models/index');
const Command = require('../command');
const ImportUtilities = require('../../ImportUtilities');
const Graph = require('../../Graph');
const Utilities = require('../../Utilities');

/**
 * Handles data read response for free.
 */
class DVDataReadResponseFreeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.web3 = ctx.web3;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
        this.notifyError = ctx.notifyError;
        this.importer = ctx.importer;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            message,
        } = command.data;


        /*
            message: {
                id: REPLY_ID
                wallet: DH_WALLET,
                data_provider_wallet: DC_WALLET,
                nodeId: KAD_ID
                agreementStatus: CONFIRMED/REJECTED,
                data: { … }
                importId: IMPORT_ID,        // Temporal. Remove it.
            },
         */

        // Is it the chosen one?
        const replyId = message.id;
        const {
            data_set_id: dataSetId,
            data_provider_wallet: dcWallet,
            wallet: dhWallet,
            transaction_hash,
        } = message;

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { reply_id: replyId },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${replyId}.`);
        }

        const networkQuery = await Models.network_queries.findOne({
            where: { id: networkQueryResponse.query_id },
        });

        if (message.agreementStatus !== 'CONFIRMED') {
            networkQuery.status = 'REJECTED';
            await networkQuery.save({ fields: ['status'] });
            throw Error('Read not confirmed');
        }

        // Calculate root hash and check is it the same on the SC.
        const { vertices, edges } = message.data;
        const fingerprint = await this.blockchain.getRootHash(dataSetId);

        if (!fingerprint || Utilities.isZeroHash(fingerprint)) {
            const errorMessage = `Couldn't not find fingerprint for Dc ${dcWallet} and import ID ${dataSetId}`;
            this.logger.warn(errorMessage);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            throw errorMessage;
        }


        ImportUtilities.sort(vertices);
        ImportUtilities.sort(edges);

        const merkle = await ImportUtilities.merkleStructure(vertices, edges);
        const rootHash = merkle.tree.getRoot();

        if (fingerprint !== rootHash) {
            const errorMessage = `Fingerprint root hash doesn't match with one from data. Root hash ${rootHash}, first DH ${dhWallet}, import ID ${dataSetId}`;
            this.logger.warn(errorMessage);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            throw errorMessage;
        }

        try {
            await this.importer.importJSON({
                vertices: message.data.vertices,
                edges: message.data.edges,
                dataSetId,
                wallet: dcWallet,
            }, false);
        } catch (error) {
            this.logger.warn(`Failed to import JSON. ${error}.`);
            this.notifyError(error);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            return Command.empty();
        }

        const dataSize = bytes(JSON.stringify(vertices));
        await Models.data_info.create({
            data_set_id: dataSetId,
            total_documents: vertices.length,
            root_hash: rootHash,
            data_provider_wallet: dcWallet,
            import_timestamp: new Date(),
            data_size: dataSize,
            origin: 'PURCHASED',
        });

        // Store holding information and generate keys for eventual data replication.
        await Models.purchased_data.create({
            data_set_id: dataSetId,
            transaction_hash,
        });

        this.logger.info(`Data set ID ${dataSetId} imported successfully.`);
        this.logger.trace(`DataSet ${dataSetId} purchased for query ID ${networkQueryResponse.query_id}, ` +
            `reply ID ${replyId}.`);
        this.remoteControl.readNotification({
            dataSetId,
            queryId: networkQueryResponse.query_id,
            replyId: networkQueryResponse.reply_id,
        });

        return Command.empty();
    }

    /**
     * Builds default DVDataReadRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvDataReadResponseFreeCommand',
            delay: 0,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DVDataReadResponseFreeCommand;
