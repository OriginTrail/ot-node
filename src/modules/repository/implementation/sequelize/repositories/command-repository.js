import Sequelize from 'sequelize';
import { COMMAND_STATUS } from '../../../../../constants/constants.js';

class CommandRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.commands;
    }

    async updateCommand(update, options) {
        await this.model.update(update, options);
    }

    async destroyCommand(name, options) {
        await this.model.destroy({
            where: {
                name: { [Sequelize.Op.eq]: name },
            },
            ...options,
        });
    }

    async createCommand(command, options) {
        return this.model.create(command, options);
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

    async removeCommands(ids, options) {
        await this.model.destroy({
            where: {
                id: { [Sequelize.Op.in]: ids },
            },
            ...options,
        });
    }

    async findFinalizedCommands(timestamp, limit) {
        return this.model.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [
                        COMMAND_STATUS.COMPLETED,
                        COMMAND_STATUS.FAILED,
                        COMMAND_STATUS.EXPIRED,
                        COMMAND_STATUS.UNKNOWN,
                    ],
                },
                startedAt: { [Sequelize.Op.lte]: timestamp },
            },
            order: [['startedAt', 'asc']],
            raw: true,
            limit,
        });
    }

    async findUnfinalizedCommandsByName(name) {
        return this.model.findAll({
            where: {
                name,
                status: {
                    [Sequelize.Op.notIn]: [
                        COMMAND_STATUS.COMPLETED,
                        COMMAND_STATUS.FAILED,
                        COMMAND_STATUS.EXPIRED,
                        COMMAND_STATUS.UNKNOWN,
                    ],
                },
            },
            raw: true,
        });
    }
}

export default CommandRepository;
