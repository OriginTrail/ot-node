const models = require('../../models');

/**
 * Fixes SQL meta information
 */
class M2SequelizeMetaMigration {
    constructor({
        logger,
    }) {
        this.logger = logger;
    }

    /**
     * Run migration
     */
    async run() {
        const tables = await models.sequelize.getQueryInterface().showAllSchemas();
        if (tables.includes('SequelizeMeta')) {
            if (tables.includes('sequelize_meta')) {
                await models.sequelize.getQueryInterface().dropTable('sequelize_meta');
            }
            await models.sequelize.getQueryInterface().renameTable('SequelizeMeta', 'sequelize_meta');
            this.logger.warn('SQL meta information about the database updated');
        }
    }
}

module.exports = M2SequelizeMetaMigration;
