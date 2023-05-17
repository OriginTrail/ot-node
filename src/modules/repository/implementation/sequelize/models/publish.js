export default (sequelize, DataTypes) => {
    const publish = sequelize.define(
        'publish',
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
    publish.associate = () => {
        // associations can be defined here
    };
    return publish;
};
