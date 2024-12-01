import Sequelize from 'sequelize';

class TokenRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.token;
    }

    async saveToken(tokenId, userId, tokenName, expiresAt, options) {
        return this.model.create(
            {
                id: tokenId,
                userId,
                expiresAt,
                name: tokenName,
            },
            options,
        );
    }

    async isTokenRevoked(tokenId) {
        const token = await this.model.findByPk(tokenId);

        return token && token.revoked;
    }

    async getTokenAbilities(tokenId) {
        const abilities = await this.sequelize.query(
            `SELECT a.name FROM token t
                INNER JOIN user u ON t.user_id = u.id
                INNER JOIN role r ON u.role_id = u.id
                INNER JOIN role_ability ra on r.id = ra.role_id
                INNER JOIN ability a on ra.ability_id = a.id
                WHERE t.id=$tokenId;`,
            { bind: { tokenId }, type: Sequelize.QueryTypes.SELECT },
        );

        return abilities.map((e) => e.name);
    }
}

export default TokenRepository;
