import Sequelize from 'sequelize';

class OperationIdRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.operation_ids;
    }

    async createOperationIdRecord(handlerData, options) {
        return this.model.create(handlerData, options);
    }

    async getOperationIdRecord(operationId, options) {
        return this.model.findOne({
            where: {
                operationId,
            },
            ...options,
        });
    }

    async updateOperationIdRecord(data, operationId, options) {
        await this.model.update(data, {
            where: {
                operationId,
            },
            ...options,
        });
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses, options) {
        await this.model.destroy({
            where: {
                timestamp: { [Sequelize.Op.lt]: timeToBeDeleted },
                status: { [Sequelize.Op.in]: statuses },
            },
            ...options,
        });
    }
}

export default OperationIdRepository;
