export default (sequelize, DataTypes) => {
    const token = sequelize.define(
        'token',
        {
            id: { type: DataTypes.STRING, primaryKey: true },
            revoked: DataTypes.BOOLEAN,
            userId: DataTypes.INTEGER,
            name: {
                type: DataTypes.STRING,
            },
            expiresAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    token.associate = (models) => {
        token.belongsTo(models.user, { as: 'user' });
    };
    return token;
};
