const routes = [
    'PUBLISH',
    'PROVISION',
    'UPDATE',
    'RESOLVE',
    'SEARCH',
    'SEARCH_ASSERTION',
    'QUERY',
    'PROOFS',
    'OPERATION_RESULT',
    'INFO',
];

module.exports = {
    up: async (queryInterface) => {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            await queryInterface.bulkInsert(
                'ability',
                routes.map((r) => ({ name: r })),
                {
                    transaction,
                },
            );
            const [abilities] = await queryInterface.sequelize.query('SELECT id from ability', {
                transaction,
            });

            await queryInterface.bulkInsert(
                'role',
                [
                    {
                        name: 'ADMIN',
                    },
                ],
                {
                    transaction,
                },
            );

            const [[role]] = await queryInterface.sequelize.query(
                "SELECT id from role where name='ADMIN'",
                {
                    transaction,
                },
            );

            const roleAbilities = abilities.map((e) => ({
                ability_id: e.id,
                role_id: role.id,
            }));

            await queryInterface.bulkInsert('role_ability', roleAbilities, { transaction });

            await queryInterface.bulkInsert(
                'user',
                [
                    {
                        name: 'node-runner',
                        role_id: role.id,
                    },
                ],
                { transaction },
            );

            transaction.commit();
        } catch (e) {
            transaction.rollback();
            throw e;
        }
    },

    down: async (queryInterface) => {
        queryInterface.sequelize.query('TRUNCATE TABLE role_ability;');
        queryInterface.sequelize.query('TRUNCATE TABLE role;');
        queryInterface.sequelize.query('TRUNCATE TABLE ability;');
    },
};
