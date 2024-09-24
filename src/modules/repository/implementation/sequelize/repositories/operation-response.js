import Sequelize from 'sequelize';

class OperationResponseRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.models = {
            get_response: models.get_response,
            publish_response: models.publish_response,
            update_response: models.update_response,
            publish_paranet_response: models.publish_paranet_response,
        };
    }

    async createOperationResponseRecord(status, operation, operationId, keyword, message) {
        const operationModel = operation.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        await this.models[`${operationModel}_response`].create({
            status,
            message,
            operationId,
            keyword,
        });
    }

    async getOperationResponsesStatuses(operation, operationId) {
        const operationModel = operation.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        return this.models[`${operationModel}_response`].findAll({
            attributes: ['status', 'keyword'],
            where: {
                operationId,
            },
        });
    }

    async findProcessedOperationResponse(timestamp, limit, operation) {
        const operationModel = operation.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        return this.models[`${operationModel}_response`].findAll({
            where: {
                createdAt: { [Sequelize.Op.lte]: timestamp },
            },
            order: [['createdAt', 'asc']],
            raw: true,
            limit,
        });
    }

    async removeOperationResponse(ids, operation) {
        const operationModel = operation.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        await this.models[`${operationModel}_response`].destroy({
            where: {
                id: { [Sequelize.Op.in]: ids },
            },
        });
    }
}

export default OperationResponseRepository;
