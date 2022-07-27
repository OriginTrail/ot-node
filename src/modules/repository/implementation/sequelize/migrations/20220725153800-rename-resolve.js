module.exports = {
    up: async (queryInterface) =>
        Promise.all([
            queryInterface.renameTable('resolve', 'get'),
            queryInterface.renameTable('resolve_response', 'get_response'),
        ]),
    down: async (queryInterface) =>
        Promise.all([
            queryInterface.renameTable('get', 'resolve'),
            queryInterface.renameTable('get_response', 'resolve_response'),
        ]),
};
