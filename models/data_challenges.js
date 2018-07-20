
module.exports = (sequelize, DataTypes) => {
    var data_challenges = sequelize.define('data_challenges', {
        time: DataTypes.INTEGER,
        block_id: DataTypes.INTEGER,
        answer: DataTypes.STRING,
        dh_id: DataTypes.STRING,
        import_id: DataTypes.STRING,
        answered: DataTypes.INTEGER,
        sent: DataTypes.BOOLEAN,
    }, {});
    data_challenges.associate = function (models) {
    // associations can be defined here
    };
    return data_challenges;
};
