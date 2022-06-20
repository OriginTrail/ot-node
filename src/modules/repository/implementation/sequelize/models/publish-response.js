const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const publish_response = sequelize.define('publish_response', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        publish_id: DataTypes.UUID,
        status: DataTypes.STRING,
        message: DataTypes.TEXT,
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    }, {});
    publish_response.associate = (models) => {
        // associations can be defined here
    };
    return publish_response;
};
