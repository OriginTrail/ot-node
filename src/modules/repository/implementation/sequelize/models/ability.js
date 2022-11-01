export default (sequelize, DataTypes) => {
    const ability = sequelize.define(
        'ability',
        {
            name: DataTypes.STRING,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        { underscored: true },
    );
    ability.associate = () => {
        // define association here
    };
    return ability;
};
