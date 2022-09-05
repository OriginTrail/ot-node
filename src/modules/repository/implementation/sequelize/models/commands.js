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
            sequence: DataTypes.JSON,
            ready_at: DataTypes.INTEGER,
            delay: DataTypes.INTEGER,
            started_at: DataTypes.INTEGER,
            deadline_at: DataTypes.INTEGER,
            period: DataTypes.INTEGER,
            status: DataTypes.STRING,
            message: DataTypes.TEXT,
            parent_id: DataTypes.UUID,
            transactional: DataTypes.BOOLEAN,
            retries: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: 'commands',
            timestamps: false,
        },
    );
    return commands;
};
