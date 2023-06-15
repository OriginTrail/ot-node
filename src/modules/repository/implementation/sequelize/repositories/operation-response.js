import Sequelize from 'sequelize';

class OperationResponseRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.models = {
            get_response: models.get_response,
            publish_response: models.publish_response,
            update_response: models.update_response,
        };
    }

    async createOperationResponseRecord(status, operation, operationId, keyword, message) {
        await this.models[`${operation}_response`].create({
            status,
            message,
            operationId,
            keyword,
        });
    }

    async getOperationResponsesStatuses(operation, operationId) {
        return this.models[`${operation}_response`].findAll({
            attributes: ['status', 'keyword'],
            where: {
                operationId,
            },
        });
    }

    async findProcessedOperationResponse(timestamp, limit, operation) {
        return this.models[`${operation}_response`].findAll({
            where: {
                startedAt: { [Sequelize.Op.lte]: timestamp },
            },
            order: [['startedAt', 'asc']],
            raw: true,
            limit,
        });
    }

    async removeOperationResponse(ids, operation) {
        await this.models[`${operation}_response`].destroy({
            where: {
                id: { [Sequelize.Op.in]: ids },
            },
        });
    }
}

export default OperationResponseRepository;
