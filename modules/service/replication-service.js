const BN = require('bn.js');
const path = require('path');
const fs = require('fs');

const Encryption = require('../RSAEncryption');
const ImportUtilities = require('../ImportUtilities');
const Utilities = require('../Utilities');
const Models = require('../../models/index');
const OtJsonUtilities = require('../OtJsonUtilities');

/**
 * Supported versions of the same data set
 * @type {{RED: string, BLUE: string, GREEN: string}}
 */
const COLOR = {
    RED: 'red',
    BLUE: 'blue',
    GREEN: 'green',
};

class ReplicationService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
        this.importService = ctx.importService;
        this.permissionedDataService = ctx.permissionedDataService;
        this.replicationCache = {};
        const replicationPath = path.join(this.config.appDataPath, 'replication_cache');

        if (!fs.existsSync(replicationPath)) {
            fs.mkdirSync(replicationPath);
        }
    }
    /**
     * Cast number to color
     * @param colorNumber: allowed numbers:
     * 0 - RED
     * 1 - GREEN
     * 2 - BLUE
     * @returns {string}
     */
    castNumberToColor(colorNumber) {
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

    /**
     * Replications cleanup (delete dir, purge cache)
     * @param internalOfferId
     * @return {Promise<void>}
     */
    async cleanup(internalOfferId) {
        this.logger.info(`Deleting replications directory and cache for offer with internal ID ${internalOfferId}`);
        const offerDirPath = this._getOfferDirPath(internalOfferId);
        await Utilities.deleteDirectory(offerDirPath);

        delete this.replicationCache[internalOfferId];
    }

    /**
     * Save single replication
     * @param color
     * @param data
     * @param internalOfferId
     */
    async saveReplication(internalOfferId, color, data) {
        const offerDirPath = this._getOfferDirPath(internalOfferId);
        await Utilities.writeContentsToFile(offerDirPath, `${color}.json`, JSON.stringify(data));
    }


    /**
     * Load replication from cache or file
     * @param internalOfferId
     * @param color
     * @return {Promise<*>}
     */
    async loadReplication(internalOfferId, color) {
        if (this.replicationCache[internalOfferId]
            && this.replicationCache[internalOfferId][color]) {
            this.logger.trace(`Loaded replication from cache for offer internal ID ${internalOfferId} and color ${color}`);
            return this.replicationCache[internalOfferId][color];
        }
        const offerDirPath = this._getOfferDirPath(internalOfferId);
        const colorFilePath = path.join(offerDirPath, `${color}.json`);

        const data = JSON.parse(await Utilities.fileContents(colorFilePath));
        if (!this.replicationCache[internalOfferId]) {
            this.replicationCache[internalOfferId] = {};
        }
        this.replicationCache[internalOfferId][color] = data;
        this.logger.trace(`Loaded replication from file for offer internal ID ${internalOfferId} and color ${color}`);

        return data;
    }

    /**
     * Gets offer directory
     * @param internalOfferId
     * @returns {string}
     */
    _getOfferDirPath(internalOfferId) {
        return path.join(
            this.config.appDataPath,
            this.config.dataSetStorage, internalOfferId,
        );
    }
}

module.exports = ReplicationService;
