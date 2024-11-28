import { Model } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

export default (sequelize, DataTypes) => {
    class commands extends Model {
        static associate(models) {
            commands._models = models;
            // define association here
        }
    }
    commands.init(
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: () => uuidv4(),
            },
            name: DataTypes.STRING,
            data: DataTypes.JSON,
            priority: DataTypes.BIGINT,
            sequence: DataTypes.JSON,
            readyAt: DataTypes.BIGINT,
            delay: DataTypes.BIGINT,
            startedAt: DataTypes.BIGINT,
            deadlineAt: DataTypes.BIGINT,
            period: DataTypes.BIGINT,
            status: DataTypes.STRING,
            message: DataTypes.TEXT,
            parentId: DataTypes.UUID,
            transactional: DataTypes.BOOLEAN,
            retries: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: 'commands',
            timestamps: false,
            underscored: true,
        },
    );
    return commands;
};
