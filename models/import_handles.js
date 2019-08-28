const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const import_handles = sequelize.define('import_handles', {
        import_handle_id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4(),
        },
        data: DataTypes.TEXT,
        status: DataTypes.STRING,
    }, {});
    import_handles.associate = (models) => {
        // associations can be defined here
    };
    return import_handles;
};
