export default (sequelize, DataTypes) => {
    const token = sequelize.define(
        'token',
        {
            id: { type: DataTypes.STRING, primaryKey: true },
            revoked: DataTypes.BOOLEAN,
            user_id: DataTypes.INTEGER,
            name: {
                type: DataTypes.STRING,
            },
            expires_at: DataTypes.DATE,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    token.associate = (models) => {
        token.belongsTo(models.user, { as: 'user' });
    };
    return token;
};
