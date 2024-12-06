export default (sequelize, DataTypes) => {
    const publishFinality = sequelize.define(
        'publish_finality',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.STRING,
            ual: DataTypes.STRING,
            finality: DataTypes.INTEGER,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    publishFinality.associate = () => {
        // associations can be defined here
    };
    return publishFinality;
};
