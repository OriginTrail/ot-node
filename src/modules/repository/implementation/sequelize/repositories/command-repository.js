import Sequelize from 'sequelize';

class CommandRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.commands;
    }

    async updateCommand(update, opts) {
        await this.model.update(update, opts);
    }

    async destroyCommand(name) {
        await this.model.destroy({
            where: {
                name: { [Sequelize.Op.eq]: name },
            },
        });
    }

    async createCommand(command, opts) {
        return this.model.create(command, opts);
    }

    async getCommandsWithStatus(statusArray, excludeNameArray) {
        return this.model.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: statusArray,
                },
                name: { [Sequelize.Op.notIn]: excludeNameArray },
            },
        });
    }

    async getCommandWithId(id) {
        return this.model.findOne({
            where: {
                id,
            },
        });
    }

    async removeFinalizedCommands(finalizedStatuses) {
        await this.model.destroy({
            where: {
                status: { [Sequelize.Op.in]: finalizedStatuses },
                startedAt: { [Sequelize.Op.lte]: Date.now() },
            },
        });
    }
}

export default CommandRepository;
