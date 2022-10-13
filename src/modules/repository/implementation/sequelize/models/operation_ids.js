import { v4 as uuidv4 } from 'uuid';

export default (sequelize, DataTypes) => {
    const operation_ids = sequelize.define(
        'operation_ids',
        {
            operation_id: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: () => uuidv4(),
            },
            data: DataTypes.TEXT,
            status: DataTypes.STRING,
            timestamp: {
                type: DataTypes.BIGINT,
                defaultValue: () => Date.now(),
            },
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    operation_ids.associate = () => {
        // associations can be defined here
    };
    return operation_ids;
};
