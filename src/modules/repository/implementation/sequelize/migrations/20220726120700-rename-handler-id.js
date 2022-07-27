module.exports = {
    up: async (queryInterface) =>
        Promise.all([
            queryInterface
                .renameTable('handler_ids', 'operation_ids')
                .then(() =>
                    queryInterface.renameColumn('operation_ids', 'handler_id', 'operation_id'),
                ),
            queryInterface.renameColumn('publish', 'handler_id', 'operation_id'),
            queryInterface.renameColumn('publish_response', 'handler_id', 'operation_id'),
            queryInterface.renameColumn('get', 'handler_id', 'operation_id'),
            queryInterface.renameColumn('get_response', 'handler_id', 'operation_id'),
            queryInterface.renameColumn('event', 'handler_id', 'operation_id'),
        ]),
    down: async (queryInterface) =>
        Promise.all([
            queryInterface
                .renameTable('operation_ids', 'handler_ids')
                .then(() =>
                    queryInterface.renameColumn('handler_ids', 'operation_id', 'handler_id'),
                ),
            queryInterface.renameColumn('get', 'operation_id', 'handler_id'),
            queryInterface.renameColumn('get_response', 'operation_id', 'handler_id'),
            queryInterface.renameColumn('publish', 'operation_id', 'handler_id'),
            queryInterface.renameColumn('publish_response', 'operation_id', 'handler_id'),
            queryInterface.renameColumn('event', 'operation_id', 'handler_id'),
        ]),
};
