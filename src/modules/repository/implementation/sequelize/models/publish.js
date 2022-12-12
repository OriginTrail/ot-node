export default (sequelize, DataTypes) => {
    const publish = sequelize.define(
        'publish',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operation_id: DataTypes.UUID,
            status: DataTypes.STRING,
            agreementId: DataTypes.STRING,
            agreementStatus: DataTypes.STRING,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    publish.associate = () => {
        // associations can be defined here
    };
    return publish;
};
