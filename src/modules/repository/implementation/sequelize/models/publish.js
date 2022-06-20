
module.exports = (sequelize, DataTypes) => {
    const publish = sequelize.define('publish', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        status: DataTypes.STRING,
        assertion_id: DataTypes.STRING,
        nodes_found: DataTypes.INTEGER,
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    }, {});
    publish.associate = (models) => {
        publish.hasMany(models.publish_response, { foreignKey: 'publish_id' });
    };
    return publish;
};
