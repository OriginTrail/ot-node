/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'Paranet',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER,
                },
                name: {
                    type: Sequelize.STRING,
                },
                blockchain_id: {
                    type: Sequelize.STRING,
                    primaryKey: true,
                },
                description: {
                    type: Sequelize.STRING,
                },
                paranet_id: {
                    type: Sequelize.STRING,
                },
                ka_count: {
                    type: Sequelize.INTEGER,
                },
                created_at: {
                    allowNull: false,
                    type: Sequelize.DATE,
                },
                updated_at: {
                    allowNull: false,
                    type: Sequelize.DATE,
                },
            },
            {
                indexes: [
                    {
                        // Composite index for optimal filtering on paranet_id and blockchain_id
                        name: 'idx_paranet_id_blockchain_id',
                        using: 'BTREE', // This is generally the default, but is specified here for clarity
                        fields: ['paranet_id', 'blockchain_id'],
                    },
                    {
                        name: 'idx_name',
                        using: 'BTREE', // This is generally the default, but is specified here for clarity
                        fields: ['name'],
                    },
                ],
            },
        );

        await queryInterface.sequelize.query(`
            CREATE TRIGGER before_insert_paranet
            BEFORE INSERT ON paranet
            FOR EACH ROW
            SET NEW.created_at = NOW();
        `);

        await queryInterface.sequelize.query(`
            CREATE TRIGGER before_update_paranet
            BEFORE UPDATE ON paranet
            FOR EACH ROW
            SET NEW.updated_at = NOW();     
        `);
    },
    async down(queryInterface) {
        await queryInterface.dropTable('Paranet');
    },
};
