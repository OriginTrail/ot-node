const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');
const MerkleTree = require('../Merkle');
const crypto = require('crypto');
const Encryption = require('../RSAEncryption');
const abi = require('ethereumjs-abi');
const ImportUtilities = require('../ImportUtilities');
const kadence = require('@deadcanaries/kadence');

class PermissionedDataService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
    }

    /**
     * Attaches the permissioned data from the permissioned_data map to the graph
     * @param graph - Array containing ot-objects
     * @param permissionedData - Map: Key->ot-object-id Value=>permissioned_data object
     */
    attachPermissionedDataToGraph(graph, permissionedData) {
        if (permissionedData && Object.keys(permissionedData).length > 0) {
            for (const otObject of graph) {
                if (otObject['@id'] in permissionedData) {
                    if (!otObject.properties) {
                        otObject.properties = {};
                    }
                    otObject.properties.permissioned_data = permissionedData[otObject['@id']];
                }
            }
        }
    }

    /**
     * Attaches the permissioned data from the ot_objects array to the map
     * @param permissionedDataMap
     * @param ot_objects
     */
    attachPermissionedDataToMap(permissionedDataMap, ot_objects) {
        if (Object.keys(permissionedDataMap).length > 0) {
            ot_objects.forEach((ot_object) => {
                if (ot_object['@id'] in permissionedDataMap) {
                    if (!ot_object.properties) {
                        throw Error(`Permissioned object ${ot_object['@id']} does not have properties`);
                    }
                    if (!ot_object.properties.permissioned_data) {
                        throw Error(`Permissioned attribute not found for object ${ot_object['@id']}`);
                    }
                    if (!ot_object.properties.permissioned_data.data) {
                        throw Error(`Permissioned data not found for object ${ot_object['@id']}`);
                    }
                    permissionedDataMap[ot_object['@id']] =
                        Utilities.copyObject(ot_object.properties.permissioned_data);
                }
            });
        }
    }

    /**
     * Retrieves all the permissioned data from one dataset for which the user has permission
     * @param dataset
     * @param buyer_node_id
     * @returns {Promise<Object>}
     */
    async getAllowedPermissionedData(dataset, buyer_node_id) {
        const permissionedData = await this.getAllowedPermissionedDataMap(
            dataset['@id'],
            buyer_node_id,
        );

        this.attachPermissionedDataToMap(permissionedData, dataset['@graph']);

        return permissionedData;
    }

    /**
     * Returns a map of objects for which the user has permission to read
     * @param dataset_id
     * @param buyer_node_id
     * @returns {Promise<void>}
     */
    async getAllowedPermissionedDataMap(
        dataset_id,
        buyer_node_id,
    ) {
        const allowedPermissionedDataElements = await Models.data_trades.findAll({
            where: {
                data_set_id: dataset_id,
                buyer_node_id,
                status: 'COMPLETED',
            },
        });

        const permissionedData = {};

        allowedPermissionedDataElements.forEach(element =>
            permissionedData[element.ot_json_object_id] = {});

        return permissionedData;
    }

    /**
     * returns @id of ot-objects with permissioned data
     * @param graph
     * @returns {Array}
     */
    getGraphPermissionedData(graph) {
        const result = [];
        graph.forEach((ot_object) => {
            if (ot_object && ot_object.properties) {
                const permissionedDataObject = ot_object.properties.permissioned_data;
                if (permissionedDataObject) {
                    if (!result.includes(ot_object['@id'])) {
                        result.push(ot_object['@id']);
                    }
                }
            }
        });
        return result;
    }

    async addDataSellerForPermissionedData(dataSetId, sellerErcId, price, sellerNodeId, dataset) {
        const permissionedData = this.getGraphPermissionedData(dataset);
        if (permissionedData.length === 0) {
            return;
        }
        const promises = [];
        permissionedData.forEach((otObjectId) => {
            promises.push(Models.data_sellers.create({
                data_set_id: dataSetId,
                ot_json_object_id: otObjectId,
                seller_node_id: Utilities.denormalizeHex(sellerNodeId),
                seller_erc_id: Utilities.normalizeHex(sellerErcId),
                price,
            }));
        });
        await Promise.all(promises);
    }

    encodePermissionedData(permissionedObject) {
        const merkleTree = ImportUtilities
            .calculatePermissionedDataMerkleTree(permissionedObject.properties.permissioned_data, 'purchase');
        const rawKey = crypto.randomBytes(32);
        const key = Utilities.normalizeHex(Buffer.from(`${rawKey}`, 'utf8').toString('hex').padStart(64, '0'));
        const encodedArray = [];
        let index = 0;
        merkleTree.levels.forEach((level) => {
            for (let i = 0; i < level.length; i += 1) {
                const leaf = level[i];
                const keyHash = abi.soliditySHA3(
                    ['bytes32', 'uint256'],
                    [key, index],
                ).toString('hex');
                encodedArray.push(Encryption.xor(leaf, keyHash));
                index += 1;
            }
        });
        const encodedMerkleTree = new MerkleTree(encodedArray, 'purchase', 'sha3');
        const encodedDataRootHash = encodedMerkleTree.getRoot();
        const sorted_data = Utilities.sortedStringify(
            permissionedObject.properties.permissioned_data.data,
            true,
        );
        const data = Buffer.from(sorted_data);
        return {
            permissioned_data_original_length: data.length,
            permissioned_data_array_length: merkleTree.levels[0].length,
            key,
            encoded_data: encodedArray,
            permissioned_data_root_hash:
                Utilities.normalizeHex(permissionedObject.properties
                    .permissioned_data.permissioned_data_hash),
            encoded_data_root_hash: Utilities.normalizeHex(encodedDataRootHash),
        };
    }

    validateAndDecodePermissionedData(
        permissionedDataArray, key,
        permissionedDataArrayLength,
        permissionedDataOriginalLength,
    ) {
        const decodedDataArray = [];
        permissionedDataArray.forEach((element, index) => {
            const keyHash = abi.soliditySHA3(
                ['bytes32', 'uint256'],
                [key, index],
            ).toString('hex');
            decodedDataArray.push(Encryption.xor(element, keyHash));
        });

        const originalDataArray = decodedDataArray.slice(0, permissionedDataArrayLength);

        // todo add validation
        // const originalDataMarkleTree = new MerkleTree(originalDataArray, 'purchase', 'sha3');
        // var index = 0;
        // originalDataMarkleTree.levels.forEach((level) => {
        //     level.forEach((leaf) => {
        //         if (leaf !== decodedDataArray[index]){
        //             //found non matching index
        //             return {
        //                 : {},
        //                 errorStatus: 'VALIDATION_FAILED',
        //             };
        //         }
        //         index += 1;
        //     });
        // });

        // recreate original object

        const first_level_blocks = constants.NUMBER_OF_PERMISSIONED_DATA_FIRST_LEVEL_BLOCKS;
        const default_block_size = constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES;

        let block_size = Math.min(Math
            .round(permissionedDataOriginalLength / first_level_blocks), default_block_size);
        block_size = block_size < 1 ? 1 : block_size;
        const numberOfBlocks = permissionedDataOriginalLength / block_size;
        let originalDataString = '';
        for (let i = 0; i < numberOfBlocks; i += 1) {
            const dataElement = Buffer.from(originalDataArray[i], 'hex');
            const block = dataElement.slice(dataElement.length - block_size, dataElement.length);
            originalDataString += block.toString();
        }

        return {
            permissionedData: JSON.parse(originalDataString),
        };
    }


    async updatePermissionedDataInDb(dataSetId, otObjectId, permissionedData) {
        const otObject = await this.graphStorage.findDocumentsByImportIdAndOtObjectId(
            dataSetId,
            otObjectId,
        );
        const documentsToBeUpdated = [];
        const calculatedPermissionedDataHash =
            ImportUtilities.calculatePermissionedDataHash({ data: permissionedData });
        otObject.relatedObjects.forEach((relatedObject) => {
            if (relatedObject.vertex.vertexType === 'Data') {
                const vertexData = relatedObject.vertex.data;
                const permissionedObject = vertexData.permissioned_data;
                if (permissionedObject &&
                    permissionedObject.permissioned_data_hash === calculatedPermissionedDataHash) {
                    permissionedObject.data = permissionedData;
                    documentsToBeUpdated.push(relatedObject.vertex);
                }
            }
        });

        const promises = [];
        documentsToBeUpdated.forEach((document) => {
            promises.push(this.graphStorage.updateDocument('ot_vertices', document));
        });
        await Promise.all(promises);
    }
}

module.exports = PermissionedDataService;
