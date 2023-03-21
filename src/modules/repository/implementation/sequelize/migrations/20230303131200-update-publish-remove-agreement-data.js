const columns = ['agreementId', 'agreementStatus'];

export async function up({ context: { queryInterface } }, logger) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
        await Promise.all(
            columns.map((column) =>
                queryInterface.removeColumn('publish', column, { transaction }).catch((error) => {
                    logger.warn(`Error removing column: ${column}: ${error.message}`);
                }),
            ),
        );

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

export async function down({ context: { queryInterface, Sequelize } }) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
        await Promise.all(
            columns.map((column) =>
                queryInterface.addColumn(
                    'publish',
                    column,
                    {
                        type: Sequelize.STRING,
                    },
                    { transaction },
                ),
            ),
        );

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
