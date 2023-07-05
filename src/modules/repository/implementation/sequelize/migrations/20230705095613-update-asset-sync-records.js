export async function up({ context: { queryInterface } }) {
    await queryInterface.bulkUpdate(
        'asset_sync',
        { status: 'ONLY_LATEST_SYNCED' },
        { status: 'COMPLETED' },
    );
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.bulkUpdate(
        'asset_sync',
        { status: 'COMPLETED' },
        { status: 'ONLY_LATEST_SYNCED' },
    );
}
