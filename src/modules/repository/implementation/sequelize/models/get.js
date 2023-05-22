export default (sequelize, DataTypes) => {
    const get = sequelize.define(
        'get',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.UUID,
            status: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    get.associate = () => {
        // associations can be defined here
    };
    return get;
};
