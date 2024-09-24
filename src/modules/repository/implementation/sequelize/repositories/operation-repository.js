import { Sequelize } from 'sequelize';

class OperationRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.models = {
            get: models.get,
            publish: models.publish,
            update: models.update,
            update_paranet: models.update_paranet,
        };
    }

    async createOperationRecord(operation, operationId, status) {
        return this.models[operation].create({
            operationId,
            status,
        });
    }

    async removeOperationRecords(operation, ids) {
        return this.models[operation].destroy({
            where: {
                id: { [Sequelize.Op.in]: ids },
            },
        });
    }

    async findProcessedOperations(operation, timestamp, limit) {
        return this.models[`${operation}`].findAll({
            where: {
                createdAt: { [Sequelize.Op.lte]: timestamp },
            },
            order: [['createdAt', 'asc']],
            raw: true,
            limit,
        });
    }

    async getOperationStatus(operation, operationId) {
        return this.models[operation].findOne({
            attributes: ['status'],
            where: {
                operationId,
            },
        });
    }

    async updateOperationStatus(operation, operationId, status) {
        await this.models[operation].update(
            { status },
            {
                where: {
                    operationId,
                },
            },
        );
    }
}

export default OperationRepository;
