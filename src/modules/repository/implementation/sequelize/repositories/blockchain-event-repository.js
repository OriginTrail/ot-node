import Sequelize from 'sequelize';

class BlockchainEventRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.blockchain_event;
    }

    async insertBlockchainEvents(events) {
        const inserted = await this.model.bulkCreate(
            events.map((event) => ({
                contract: event.contract,
                event: event.event,
                data: event.data,
                block: event.block,
                blockchainId: event.blockchainId,
                processed: false,
            })),
            {
                ignoreDuplicates: true,
            },
        );
        return inserted.map((event) => event.dataValues);
    }

    async getAllUnprocessedBlockchainEvents(eventNames) {
        return this.model.findAll({
            where: {
                processed: false,
                event: { [Sequelize.Op.in]: eventNames },
            },
            order: [['block', 'asc']],
        });
    }

    async blockchainEventExists(contract, event, data, block, blockchainId) {
        const dbEvent = await this.model.findOne({
            where: {
                contract,
                event,
                data,
                block,
                blockchainId,
            },
        });
        return !!dbEvent;
    }

    async markBlockchainEventsAsProcessed(events) {
        const idsForUpdate = events.map((event) => event.id);
        return this.model.update(
            { processed: true },
            {
                where: { id: { [Sequelize.Op.in]: idsForUpdate } },
            },
        );
    }

    async removeEvents(ids) {
        await this.model.destroy({
            where: {
                id: { [Sequelize.Op.in]: ids },
            },
        });
    }

    async findProcessedEvents(timestamp, limit) {
        return this.model.findAll({
            where: {
                processed: true,
                startedAt: { [Sequelize.Op.lte]: timestamp },
            },
            order: [['startedAt', 'asc']],
            raw: true,
            limit,
        });
    }
}

export default BlockchainEventRepository;
