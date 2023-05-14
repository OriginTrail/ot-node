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
                blockchain_id: event.blockchainId,
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
                blockchain_id: blockchainId,
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
}

export default BlockchainEventRepository;
