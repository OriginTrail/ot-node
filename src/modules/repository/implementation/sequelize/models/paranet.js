export default (sequelize, DataTypes) => {
    const paranet = sequelize.define(
        'paranet',
        {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER,
            },
            name: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            description: {
                type: DataTypes.STRING,
            },
            paranetId: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            kaCount: {
                allowNull: false,
                type: DataTypes.INTEGER,
            },
            blockchainId: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE,
            },
            updatedAt: {
                allowNull: false,
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
