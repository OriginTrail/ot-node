const Models = require('../../models');
const Utilities = require('../Utilities');

class PermissionedDataService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
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
            ot_objects.forEach((ot_object, index) => {
                const permissionedDataObject = ot_object.properties.permissioned_data;

                const { ot_json_object_id } = permissionedDataMap[index];
                permissionedDataMap[ot_json_object_id] = permissionedDataObject;
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
}

module.exports = PermissionedDataService;
