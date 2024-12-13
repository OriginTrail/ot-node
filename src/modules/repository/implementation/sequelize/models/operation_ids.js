import { v4 as uuidv4 } from 'uuid';

export default (sequelize, DataTypes) => {
    const operationIds = sequelize.define(
        'operation_ids',
        {
            operationId: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: () => uuidv4(),
            },
            data: DataTypes.TEXT,
            status: DataTypes.STRING,
            minAcksReached: DataTypes.BOOLEAN,
            timestamp: {
                type: DataTypes.BIGINT,
                defaultValue: () => Date.now(),
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    operationIds.associate = () => {
        // associations can be defined here
    };
    return operationIds;
};
