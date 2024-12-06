export default (sequelize, DataTypes) => {
    const publishFinality = sequelize.define(
        'publish_finality',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            blockchainId: DataTypes.STRING,
            ual: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            finality: DataTypes.STRING,
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
