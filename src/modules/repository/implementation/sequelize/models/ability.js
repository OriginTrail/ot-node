export default (sequelize, DataTypes) => {
    const ability = sequelize.define(
        'ability',
        {
            name: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    ability.associate = () => {
        // define association here
    };
    return ability;
};
