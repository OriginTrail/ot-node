export default (sequelize, DataTypes) => {
    const publishfinality = sequelize.define(
        'publishfinality',
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
    publishfinality.associate = () => {
        // associations can be defined here
    };
    return publishfinality;
};
