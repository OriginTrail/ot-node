export async function up({ context: { queryInterface } }) {
    await queryInterface.addIndex('blockchain_event', ['processed'], {
        name: 'idx_blockchain_event_processed',
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.removeIndex('blockchain_event', 'idx_blockchain_event_processed');
}
