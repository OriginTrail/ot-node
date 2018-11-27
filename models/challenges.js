
module.exports = (sequelize, DataTypes) => {
    const challenges = sequelize.define('challenges', {
        dh_id: DataTypes.STRING,
        block_id: DataTypes.INTEGER,
        answer: DataTypes.STRING,
        expected_answer: DataTypes.STRING,
        data_set_id: DataTypes.STRING,
        start_time: DataTypes.INTEGER,
        end_time: DataTypes.INTEGER,
    }, {});
    challenges.associate = (models) => {
        // associations can be defined here
    };
    return challenges;
};
