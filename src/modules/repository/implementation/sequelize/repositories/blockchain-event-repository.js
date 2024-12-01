import Sequelize from 'sequelize';

class BlockchainEventRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.blockchain_event;
    }

    async insertBlockchainEvents(events) {
        const chunkSize = 10000;
        let insertedEvents = [];

        for (let i = 0; i < events.length; i += chunkSize) {
            const chunk = events.slice(i, i + chunkSize);
            // eslint-disable-next-line no-await-in-loop
            const insertedChunk = await this.model.bulkCreate(
                chunk.map((event) => ({
                    contract: event.contract,
                    event: event.event,
                    data: event.data,
                    block: event.block,
                    blockchain: event.blockchain,
                    processed: false,
                })),
                {
                    ignoreDuplicates: true,
                },
            );

            insertedEvents = insertedEvents.concat(insertedChunk.map((event) => event.dataValues));
        }

        return insertedEvents;
    }

    async getAllUnprocessedBlockchainEvents(eventNames, blockchain) {
        return this.model.findAll({
            where: {
                blockchain,
                processed: false,
                event: { [Sequelize.Op.in]: eventNames },
            },
            order: [['block', 'asc']],
        });
    }

    async blockchainEventExists(contract, event, data, block, blockchain) {
        const dbEvent = await this.model.findOne({
            where: {
                contract,
                event,
                data,
                block,
                blockchain,
            },
        });
        return !!dbEvent;
    }

    async markBlockchainEventsAsProcessed(events) {
        const idsForUpdate = events.flatMap((event) => event.id);
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
                createdAt: { [Sequelize.Op.lte]: timestamp },
            },
            order: [['createdAt', 'asc']],
            raw: true,
            limit,
        });
    }
}

export default BlockchainEventRepository;
