export const up = async ({ context: { queryInterface, Sequelize } }) => {
    await queryInterface.createTable('paranet', {
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
            defaultValue: Sequelize.literal('NOW()'),
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });
};

export const down = async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('Paranet');
};
