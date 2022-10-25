export default (sequelize, DataTypes) => {
    const event = sequelize.define(
        'blockchain_event',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            contract: DataTypes.STRING,
            blockchain_id: DataTypes.STRING,
            event: DataTypes.STRING,
            data: DataTypes.TEXT,
            block: DataTypes.INTEGER,
            finished: DataTypes.INTEGER,
        },
        {},
    );
    event.associate = () => {
        // associations can be defined here
    };
    return event;
};
