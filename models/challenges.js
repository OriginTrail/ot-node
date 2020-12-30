const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const challenges = sequelize.define('challenges', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4(),
        },
        dh_id: DataTypes.STRING,
        dh_identity: DataTypes.STRING,
        test_index: DataTypes.INTEGER,
        object_index: DataTypes.INTEGER,
        block_index: DataTypes.INTEGER,
        offer_id: DataTypes.STRING,
        blockchain_id: DataTypes.STRING,
        answer: DataTypes.STRING,
        expected_answer: DataTypes.STRING,
        data_set_id: DataTypes.STRING,
        start_time: DataTypes.BIGINT,
        end_time: DataTypes.BIGINT,
        status: DataTypes.STRING,
    }, {});
    challenges.associate = (models) => {
        // associations can be defined here
    };
    return challenges;
};
