import { Sequelize } from 'sequelize';

class OperationRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.models = {
            get: models.get,
            publish: models.publish,
            update: models.update,
            publish_paranet: models.publish_paranet,
        };
    }

    async createOperationRecord(operation, operationId, status) {
        const operationModel = operation.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        return this.models[operationModel].create({
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
