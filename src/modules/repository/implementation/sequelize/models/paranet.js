export default (sequelize, DataTypes) => {
    const paranet = sequelize.define(
        'paranet',
        {
            id: {
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER,
            },
            name: {
                type: DataTypes.STRING,
            },
            description: {
                type: DataTypes.STRING,
            },
            paranetId: {
                type: DataTypes.STRING,
            },
            kaCount: {
                type: DataTypes.INTEGER,
            },
            blockchainId: {
                type: DataTypes.STRING,
            },
            createdAt: {
                type: DataTypes.DATE,
            },
            updatedAt: {
                type: DataTypes.DATE,
            },
        },
        { underscored: true },
    );
    paranet.associate = () => {
        // associations can be defined here
    };
    return paranet;
};
