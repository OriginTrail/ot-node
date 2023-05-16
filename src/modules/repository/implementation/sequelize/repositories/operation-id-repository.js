import Sequelize from 'sequelize';

class OperationIdRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.operation_ids;
    }

    async createOperationIdRecord(handlerData) {
        return this.model.create(handlerData);
    }

    async getOperationIdRecord(operationId) {
        return this.model.findOne({
            where: {
                operation_id: operationId,
            },
        });
    }

    async updateOperationIdRecord(data, operationId) {
        await this.model.update(data, {
            where: {
                operation_id: operationId,
            },
        });
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses) {
        await this.model.destroy({
            where: {
                timestamp: { [Sequelize.Op.lt]: timeToBeDeleted },
                status: { [Sequelize.Op.in]: statuses },
            },
        });
    }
}

export default OperationIdRepository;
