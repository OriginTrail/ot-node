const GraphStorage = require('../Database/GraphStorage');
const Blockchain = require('../Blockchain');
const log = require('../logger');
const Models = require('../../models');
const BlockchainPluginService = require('../Blockchain/plugin/blockchain-plugin-service');


const COLOR = {
    RED: 'red',
    BLUE: 'blue',
    GREEN: 'green',
};
function castNumberToColor(colorNumber) {
    switch (colorNumber) {
    case 0:
        return COLOR.RED;
    case 1:
        return COLOR.GREEN;
    case 2:
        return COLOR.BLUE;
    default:
        throw new Error(`Failed to cast number to color ${colorNumber}, allowed number 0, 1, 2`);
    }
}

process.on('message', async (dataFromParent) => {
    const {
        database, config, allMyIdentities,
    } = JSON.parse(dataFromParent);

    const blockchainPluginService = new BlockchainPluginService({ config });
    const blockchain = new Blockchain({ config, logger: log, blockchainPluginService });

    try {
        const result = [];
        const bids = await Models.bids.findAll({
            attributes: ['data_set_id', 'offer_id', 'blockchain_id', 'status'],
            where: {
                status: { [Models.Sequelize.Op.in]: ['CHOSEN', 'NOT_CHOSEN'] },
            },
        });

        for (const bid of bids) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const holder = await blockchain
                    .getHolder(
                        bid.offer_id,
                        allMyIdentities[bid.blockchain_id],
                        bid.blockchain_id,
                    ).response;
                if (bid.status === 'CHOSEN' && holder.stakedAmount !== '0') {
                    const encryptionColor =
                        castNumberToColor(parseInt(holder.litigationEncryptionType, 10));
                    result.push({
                        data_set_id: bid.data_set_id,
                        offer_id: bid.offer_id,
                        encryptionColor,
                    });
                } else if (bid.status === 'NOT_CHOSEN' && holder.stakedAmount === '0') {
                    result.push({
                        data_set_id: bid.data_set_id,
                        offer_id: bid.offer_id,
                        encryptionColor: null,
                    });
                }
            } catch (error) {
                this.logger.warn(`Unable to fetch encryption data for offer id: ${bid.offer_id}. Error: ${error.message}`);
            }
        }

        const graphStorage = new GraphStorage(database, null);
        await graphStorage.connect();

        for (const object of result) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await graphStorage.removeUnnecessaryEncryptionData(
                    object.data_set_id,
                    object.offer_id,
                    object.encryptionColor,
                );
            } catch (error) {
                this.logger.warn(`Unable to remove encryption data for offer id: ${object.offer_id}. Error: ${error.message}`);
            }
        }

        process.send(JSON.stringify({ status: 'COMPLETED' }), () => {
            process.exit(0);
        });
    } catch (error) {
        process.send({ error: `${error.message}\n${error.stack}` });
    }
});

process.once('SIGTERM', () => process.exit(0));
