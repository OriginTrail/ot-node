const Models = require('../../models/index');
const { QueryTypes } = require('sequelize');
const sequelizeConfig = require('../../config/sequelizeConfig');
const constants = require('./../constants');

const defaultBackupFolderPath = '/ot-node/backup/';

class DatasetPruningService {
    /**
     * Default constructor
     * @param ctx
     */
    constructor(ctx) {
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.diskService = ctx.diskService;
        this.config = ctx.config;
    }

    getIdsForPruning(
        repackedDatasets,
        importedPruningDelayInMinutes,
        replicatedPruningDelayInMinutes,
    ) {
        const importedPruningDelayInMilisec = importedPruningDelayInMinutes * 60 * 1000;
        const replicatedPruningDelayInMilisec = replicatedPruningDelayInMinutes * 60 * 1000;
        const datasetsToBeDeleted = [];
        let dataInfoIdToBeDeleted = [];
        let offerIdToBeDeleted = [];

        const now = (new Date()).getTime();
        Object.keys(repackedDatasets).forEach((key) => {
            const dataset = repackedDatasets[key];
            // there are no bids or offers associated with datasetId
            if (dataset.offers.length === 0 && dataset.bids.length === 0) {
                let dataInfoDeletedCount = 0;
                // import delay
                dataset.dataInfo.forEach((dataInfo) => {
                    if (dataInfo.importTimestamp +
                        importedPruningDelayInMilisec < now) {
                        dataInfoIdToBeDeleted.push(dataInfo.id);
                        dataInfoDeletedCount += 1;
                    }
                });
                if (dataset.dataInfo.length === dataInfoDeletedCount) {
                    const latestImportTimestamp =
                        Math.max(...dataset.dataInfo.map(di => di.importTimestamp));
                    datasetsToBeDeleted.push({
                        datasetId: key,
                        importTimestamp: latestImportTimestamp,
                    });
                }
            } else {
                const latestImportTimestamp =
                    Math.max(...dataset.dataInfo.map(di => di.importTimestamp));

                // get offer ids for pruning
                const offerIds = this.getIdsForPruningFromArray(
                    dataset.offers,
                    latestImportTimestamp,
                    replicatedPruningDelayInMilisec,
                );
                const offersDeletedCount = offerIds.length;
                offerIdToBeDeleted = offerIdToBeDeleted.concat(offerIds);

                // get bid ids for pruning
                const bidIds = this.getIdsForPruningFromArray(
                    dataset.bids,
                    latestImportTimestamp,
                    replicatedPruningDelayInMilisec,
                );
                const bidsDeletedCount = bidIds.length;

                // get data info ids for pruning
                if (offersDeletedCount === dataset.offers.length &&
                bidsDeletedCount === dataset.bids.length) {
                    datasetsToBeDeleted.push({
                        datasetId: key,
                        importTimestamp: latestImportTimestamp,
                    });
                    dataInfoIdToBeDeleted = dataInfoIdToBeDeleted
                        .concat(dataset.dataInfo.map(di => di.id));
                }
            }
        });

        return {
            datasetsToBeDeleted,
            offerIdToBeDeleted,
            dataInfoIdToBeDeleted,
        };
    }

    async fetchDatasetData() {
        const queryString = 'select di.id as data_info_id, offer.id as offer_id, bid.id as bid_id, pd.id as purchased_data_id, di.data_set_id, di.import_timestamp, \n' +
            'offer.holding_time_in_minutes as offer_holding_time_in_minutes,\n' +
            'bid.holding_time_in_minutes as bid_holding_time_in_minutes \n' +
            'from data_info as di\n' +
            'left join offers as offer on di.data_set_id = offer.data_set_id\n' +
            'left join bids as bid on di.data_set_id = bid.data_set_id\n' +
            'left join purchased_data as pd on di.data_set_id = pd.data_set_id';
        return Models.sequelize.query(queryString, { type: QueryTypes.SELECT });
    }

    async updatePruningHistory(datasetsToBeDeleted) {
        const now = (new Date()).getTime();
        for (const dataset of datasetsToBeDeleted) {
            // eslint-disable-next-line no-await-in-loop
            await Models.pruning_history.create({
                data_set_id: dataset.datasetId,
                imported_timestamp: dataset.importTimestamp,
                pruned_timestamp: now,
            });
        }
    }

    async removeEntriesWithId(table, idArray) {
        if (idArray && idArray.length > 0) {
            await Models[table].destroy({
                where: {
                    id: { [Models.sequelize.Op.in]: idArray },
                },
            });
        }
    }

    async removeDatasetsFromGraphDb(datasets) {
        for (const dataset of datasets) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await this.graphStorage.removeDataset(dataset.datasetId);
            } catch (error) {
                this.logger.debug(`Unable to prune dataset with id: ${dataset.datasetId}. Error message: ${error.message}`);
            }
        }
    }

    getIdsForPruningFromArray(array, latestImportTimestamp, replicatedPruningDelayInMilisec) {
        const now = (new Date()).getTime();
        const idsForPruning = [];
        if (array.length > 0) {
            array.forEach((element) => {
                if (latestImportTimestamp +
                    replicatedPruningDelayInMilisec +
                    (element.holdingTimeInMinutes * 60 * 1000) < now) {
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
    repackDatasets(datasets, includePurchased = false) {
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
            const foundDataInfoId = repackedDatasets[dataset.data_set_id].dataInfo
                .some(el => el.id === dataset.data_info_id);
            if (!foundDataInfoId) {
                repackedDatasets[dataset.data_set_id].dataInfo.push({
                    id: dataset.data_info_id,
                    importTimestamp: new Date(dataset.import_timestamp).getTime(),
                });
            }

            if (dataset.offer_id) {
                const foundOfferId = repackedDatasets[dataset.data_set_id].offers
                    .some(el => el.id === dataset.offer_id);
                if (!foundOfferId) {
                    repackedDatasets[dataset.data_set_id].offers.push({
                        id: dataset.offer_id,
                        holdingTimeInMinutes: dataset.offer_holding_time_in_minutes,
                    });
                }
            }
            if (dataset.bid_id) {
                const foundBidId = repackedDatasets[dataset.data_set_id].bids
                    .some(el => el.id === dataset.bid_id);
                if (!foundBidId) {
                    repackedDatasets[dataset.data_set_id].bids.push({
                        id: dataset.bid_id,
                        holdingTimeInMinutes: dataset.bid_holding_time_in_minutes,
                    });
                }
            }
        });
        return repackedDatasets;
    }

    shouldPruneLowEstimatedValueDatasets() {
        try {
            if (!this.config.dataset_pruning.low_estimated_value_datasets.enabled) {
                return false;
            }
            const diskSpace = this.diskService.getRootFolderInfo();
            const freeSpacePercentage = (100 * diskSpace.free) / diskSpace.total;
            const arangoDbEngineFolderSize = this.diskService
                .getFolderSize(this.config.database.engine_folder_path);
            const minimumArangoDbFolderSizeForPruning = 0.2 * diskSpace.total;
            if (freeSpacePercentage > this.config.dataset_pruning
                .low_estimated_value_datasets.minimum_free_space_percentage) {
                this.logger.debug(`There is enough free space on the disk, low estimated value datasets pruning will not be executed. Disk free space: ${freeSpacePercentage}%`);
                return false;
            }

            if (this.diskService.folderExists(defaultBackupFolderPath)
                && this.diskService.getFolderSize(defaultBackupFolderPath) > 0) {
                this.logger.warn('Detected ot-node backup on machine. please remove backup data in order to enable low estimated value datasets pruning!');
                return false;
            }

            if (arangoDbEngineFolderSize > minimumArangoDbFolderSizeForPruning) {
                this.logger.warn('Reached minimum Graph DB folder size, low estimated value datasets wont be pruned. ' +
                    `Minimum size of Graph DB is 20% of total disk size. Current Graph DB folder size is: ${arangoDbEngineFolderSize}kb`);
                return false;
            }
            this.logger.debug('Bulk pruning of low estimated datasets will be executed.');
            return true;
        } catch (error) {
            this.logger.error('Error while trying to determine should low estimated datasets be pruned. Error: ', error.message);
            return false;
        }
    }

    async findLowEstimatedValueDatasets() {
        const queryString = 'select di.id as data_info_id, di.data_set_id, bid.status as bid_status, ' +
            'bid.id as bid_id, (di.import_timestamp + bid.holding_time_in_minutes*60000) as expiry,' +
            'offer.id as offer_id, pd.id as purchase_id, di.import_timestamp ' +
            'from data_info as di ' +
            'left join offers as offer on di.data_set_id = offer.data_set_id ' +
            'inner join bids as bid on di.data_set_id = bid.data_set_id ' +
            'left join purchased_data as pd on di.data_set_id = pd.data_set_id ' +
            'order by (di.import_timestamp + bid.holding_time_in_minutes*60000)';
        return Models.sequelize.query(queryString, { type: QueryTypes.SELECT });
    }

    /**
     * Returns repacked dataset information in format:
     * {
     *     [data_set_id]: {
     *         dataInfos: [],
     *         bids: [],
     *         expiry: timestamp,
     *         chosen: false,
     *         foundOffer: false,
     *         foundPurchase: false,
     *     }
     * }
     * @param datasets
     * @returns {{}}
     */
    repackLowEstimatedValueDatasets(datasets) {
        const repackedDatasets = {};
        datasets.forEach((dataset) => {
            if (!repackedDatasets[dataset.data_set_id]) {
                repackedDatasets[dataset.data_set_id] = {
                    dataInfos: [],
                    bids: [],
                };
            }
            if (!repackedDatasets[dataset.data_set_id].expiry
                || repackedDatasets[dataset.data_set_id].expiry < dataset.expiry) {
                repackedDatasets[dataset.data_set_id].expiry = dataset.expiry;
            }
            const foundDataInfoId = repackedDatasets[dataset.data_set_id].dataInfos
                .includes(dataset.data_info_id);
            if (!foundDataInfoId) {
                repackedDatasets[dataset.data_set_id].dataInfos.push(dataset.data_info_id);
                repackedDatasets[dataset.data_set_id].importTimestamp = dataset.import_timestamp;
            }

            if (dataset.bid_id) {
                const foundBidId = repackedDatasets[dataset.data_set_id].bids
                    .includes(dataset.bid_id);
                if (!foundBidId) {
                    repackedDatasets[dataset.data_set_id].bids.push(dataset.bid_id);
                    if (dataset.bid_status === 'CHOSEN') {
                        repackedDatasets[dataset.data_set_id].chosen = true;
                    }
                }
            }
            if (dataset.offer_id) {
                repackedDatasets[dataset.data_set_id].foundOffer = true;
            }
            if (dataset.purchase_id) {
                repackedDatasets[dataset.data_set_id].foundPurchase = true;
            }
        });
        return repackedDatasets;
    }

    getLowEstimatedValueIdsForPruning(repackedDatasets) {
        const idsForPruning = {
            datasetsToBeDeleted: [],
            dataInfoIdToBeDeleted: [],
            bidIdToBeDeleted: [],
        };

        let datasetsArray = [];
        Object.keys(repackedDatasets).forEach((key) => {
            const dataset = repackedDatasets[key];
            if (!dataset.foundOffer && !dataset.foundPurchase && !dataset.chosen) {
                datasetsArray.push({
                    expiry: dataset.expiry,
                    datasetId: {
                        id: key,
                        importTimestamp: dataset.import_timestamp,
                    },
                    dataInfoIds: dataset.dataInfos,
                    bidsIds: dataset.bids,
                });
            }
        });

        datasetsArray = datasetsArray
            .sort((a, b) => a.expiry - b.expiry)
            .splice(0, constants.LOW_ESTIMATED_VALUE_DATASETS_PRUNING_BATCH_NUMBER);

        datasetsArray.forEach((dataset) => {
            idsForPruning.datasetsToBeDeleted.push({
                datasetId: dataset.datasetId.id,
                importTimestamp: dataset.datasetId.importTimestamp,
            });
            idsForPruning.dataInfoIdToBeDeleted =
                idsForPruning.dataInfoIdToBeDeleted.concat(dataset.dataInfoIds);
            idsForPruning.bidIdToBeDeleted =
                idsForPruning.bidIdToBeDeleted.concat(dataset.bidsIds);
        });
        return idsForPruning;
    }
}

module.exports = DatasetPruningService;
