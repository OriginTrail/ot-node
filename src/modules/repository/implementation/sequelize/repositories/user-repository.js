class UserRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.user;
    }

    async getUser(username, options) {
        return this.model.findOne({
            where: {
                name: username,
            },
            ...options,
        });
    }
}

export default UserRepository;
