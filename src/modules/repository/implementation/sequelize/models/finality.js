export default (sequelize, DataTypes) => {
    const finality = sequelize.define(
        'finality',
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
    finality.associate = () => {
        // associations can be defined here
    };
    return finality;
};
