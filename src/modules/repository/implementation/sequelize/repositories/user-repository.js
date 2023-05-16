class UserRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.user;
    }

    async getUser(username) {
        return this.model.findOne({
            where: {
                name: username,
            },
        });
    }
}

export default UserRepository;
