const { Model } = require('sequelize');
const uuid = require('uuid');

module.exports = (sequelize, DataTypes) => {
    class jobs extends Model {
        static associate(models) {
            jobs._models = models;
            // define association here
        }
    }
    jobs.init({
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuid.v4(),
        },
        publisher: DataTypes.STRING,
        assertion_hash: DataTypes.STRING,
        tx_hash: DataTypes.STRING,
        signature: DataTypes.TEXT,
        blockchain_id: DataTypes.STRING,
        published_to: DataTypes.TEXT,
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'jobs',
    });
    return jobs;
};
