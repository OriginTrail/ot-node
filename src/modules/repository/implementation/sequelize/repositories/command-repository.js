import Sequelize from 'sequelize';
import { COMMAND_STATUS } from '../../../../../constants/constants.js';

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

    async removeCommands(ids) {
        await this.model.destroy({
            where: {
                id: { [Sequelize.Op.in]: ids },
            },
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
