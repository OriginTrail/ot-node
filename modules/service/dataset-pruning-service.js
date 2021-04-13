const Models = require('../../models/index');
const { QueryTypes } = require('sequelize');
const constants = require('../constants');

class DatasetPruningService {
    /**
     * Default constructor
     * @param ctx
     */
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    async pruneDatasets(prunePurchasedDatasets = false) {
        const queryString = 'select di.id as data_info_id, offer.id as offer_id, bid.id as bid_id, pd.id as purchased_data_id, di.data_set_id, di.import_timestamp, \n' +
            'offer.holding_time_in_minutes as offer_holding_time_in_minutes,\n' +
            'bid.holding_time_in_minutes as bid_holding_time_in_minutes \n' +
            'from data_info as di\n' +
            'left join offers as offer on di.data_set_id = offer.data_set_id\n' +
            'left join bids as bid on di.data_set_id = bid.data_set_id\n' +
            'left join purchased_data as pd on di.data_set_id = pd.data_set_id';
        const datasets = await Models.sequelize.query(queryString, { type: QueryTypes.SELECT });

        const repackedDatasets = this.repackDatasets(datasets, !prunePurchasedDatasets);

        if (!datasets) {
            this.logger.trace('Found 0 datasets for pruning');
            return;
        }
        const datasetsToBeDeleted = [];
        let dataInfoIdToBeDeleted = [];
        let offerIdToBeDeleted = [];
        let bidsIdToBeDeleted = [];

        const now = (new Date()).getTime();
        Object.keys(repackedDatasets).forEach((key) => {
            const dataset = repackedDatasets[key];

            if (dataset.offers.length === 0 && dataset.bids.length === 0) {
                let dataInfoDeletedCount = 0;
                dataset.dataInfo.forEach((dataInfo) => {
                    if (dataInfo.importTimestamp +
                        constants.DATASET_MINIMUM_VALIDITY_PERIOD_MILLS < now) {
                        dataInfoIdToBeDeleted.push(dataInfo.id);
                        dataInfoDeletedCount += 1;
                    }
                });
                if (dataset.dataInfo.length === dataInfoDeletedCount) {
                    datasetsToBeDeleted.push(key);
                }
            } else {
                const latestImportTimestamp =
                    Math.max(...dataset.dataInfo.map(di => di.importTimestamp));

                const offerIds = this
                    .getIdsForPruningFromArray(dataset.offers, latestImportTimestamp, now);
                const offersDeletedCount = offerIds.length;
                offerIdToBeDeleted = offerIdToBeDeleted.concat(offerIds);

                const bidIds = this
                    .getIdsForPruningFromArray(dataset.bids, latestImportTimestamp, now);
                const bidsDeletedCount = bidIds.length;
                bidsIdToBeDeleted = bidsIdToBeDeleted.concat(bidIds);


                if (offersDeletedCount === dataset.offers.length &&
                bidsDeletedCount === dataset.bids.length) {
                    datasetsToBeDeleted.push(key);
                    dataInfoIdToBeDeleted = dataInfoIdToBeDeleted
                        .concat(dataset.dataInfo.map(di => di.id));
                }
            }
        });
    }

    getIdsForPruningFromArray(array, latestImportTimestamp, now) {
        const idsForPruning = [];
        if (array.length > 0) {
            array.forEach((element) => {
                if (latestImportTimestamp +
                    (element.holdingTimeInMinutes * 60 * 1000) +
                    constants.DATASET_MINIMUM_VALIDITY_PERIOD_MILLS < now) {
                    idsForPruning.push(element.id);
                }
            });
        }
        return idsForPruning;
    }

    /**
     * Returns repacked dataset information in format:
     * {
     *     [data_set_id]: {
     *         dataInfo: [{
     *             id: ...
     *             importTimestamp: ...
     *         }],
     *         offers: [{
     *             id: ...
     *             holdingTimeInMinutes: ...
     *         }],
     *         bids: [{
     *             id: ...
     *             holdingTimeInMinutes: ...
     *         }]
     *     }
     * }
     * @param datasets
     * @returns {{}}
     */
    repackDatasets(datasets, includePurchased) {
        const repackedDatasets = {};
        datasets.forEach((dataset) => {
            if (!includePurchased && dataset.purchased_data_id) {
                return;
            }
            if (!repackedDatasets[dataset.data_set_id]) {
                repackedDatasets[dataset.data_set_id] = {
                    dataInfo: [],
                    offers: [],
                    bids: [],
                };
            }
            repackedDatasets[dataset.data_set_id].dataInfo.push({
                id: dataset.data_info_id,
                importTimestamp: new Date(dataset.import_timestamp).getTime(),
            });
            if (dataset.offer_id) {
                repackedDatasets[dataset.data_set_id].offers.push({
                    id: dataset.offer_id,
                    holdingTimeInMinutes: dataset.offer_holding_time_in_minutes,
                });
            }
            if (dataset.bid_id) {
                repackedDatasets[dataset.data_set_id].bids.push({
                    id: dataset.bid_id,
                    holdingTimeInMinutes: dataset.bid_holding_time_in_minutes,
                });
            }
        });
        return repackedDatasets;
    }
}

module.exports = DatasetPruningService;
