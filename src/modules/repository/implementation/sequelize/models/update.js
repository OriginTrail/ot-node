export default (sequelize, DataTypes) => {
    const update = sequelize.define(
        'update',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.UUID,
            status: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    update.associate = () => {
        // associations can be defined here
    };
    return update;
};
