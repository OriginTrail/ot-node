export default (sequelize, DataTypes) => {
    const ability = sequelize.define(
        'ability',
        {
            name: DataTypes.STRING,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    ability.associate = () => {
        // define association here
    };
    return ability;
};
