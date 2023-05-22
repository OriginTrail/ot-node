class OperationRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.models = { get: models.get, publish: models.publish, update: models.update };
    }

    async createOperationRecord(operation, operationId, status) {
        return this.models[operation].create({
            operationId,
            status,
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
