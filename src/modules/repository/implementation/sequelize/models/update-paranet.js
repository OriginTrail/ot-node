export default (sequelize, DataTypes) => {
    const updateParanet = sequelize.define(
        'updateParanet',
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
    updateParanet.associate = () => {
        // associations can be defined here
    };
    return updateParanet;
};
