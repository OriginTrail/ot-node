module.exports = {
    up: async (queryInterface) => {
        await queryInterface.sequelize.query('DELETE FROM commands WHERE name = \'dhLitigationInitiatedCommand\'');
    },
    down: async () => { },
};
