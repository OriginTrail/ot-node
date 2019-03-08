
module.exports = {
    up: async (queryInterface) => {
        await queryInterface.sequelize
            .query("UPDATE offers SET global_status='COMPLETED' WHERE status='COMPLETED'");
        await queryInterface.sequelize
            .query("UPDATE offers SET global_status='FAILED' WHERE status='FAILED'");
        await queryInterface.sequelize
            .query("UPDATE offers SET global_status='ACTIVE' WHERE status NOT IN ('COMPLETED', 'FAILED')");
    },
    down: async (queryInterface) => {
    },
};
