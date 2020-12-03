module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'handler_ids',
            'timestamp',
            {
                type: Sequelize.BIGINT,
            },
        );
        const now = Date.now();
        await queryInterface.sequelize.query(`UPDATE handler_ids SET timestamp = ${now} `);
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('handler_ids', 'timestamp');
    },
};
