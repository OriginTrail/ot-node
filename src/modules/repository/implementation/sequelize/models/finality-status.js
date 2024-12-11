export default (sequelize, DataTypes) => {
    const finalityStatus = sequelize.define(
        'finality_status',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.STRING,
            ual: DataTypes.STRING,
            peerId: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    finalityStatus.associate = () => {
        // associations can be defined here
    };
    return finalityStatus;
};
