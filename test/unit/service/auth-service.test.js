require('dotenv').config();
const { expect } = require('chai');
const { describe, it, afterEach } = require('mocha');
const uuid = require('uuid').v4;
const sinon = require('sinon');

const AuthService = require('../../../src/service/auth-service');
const jwtUtil = require('../../../src/service/util/jwt-util');
const RepositoryModuleManager = require('../../../src/modules/repository/repository-module-manager');

const whitelistedIps = [
    '::1',
    '127.0.0.1',
    '54.31.28.8',
    'a3c6:3c39:492c:831b:d1a1:7944:b984:f32a',
];
const invalidIps = ['247.8.32.50', null, undefined, {}, [], true, false, 123, '123...', NaN];
const invalidTokens = ['token', 12345, {}, [], undefined, null, true, false, '123.321.32', NaN];

const tests = [
    {
        ipAuthEnabled: false,
        tokenAuthEnabled: false,
        ipValid: false,
        tokenValid: false,
        tokenRevoked: false,
        tokenExpired: false,
        expected: true,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: false,
        ipValid: false,
        tokenValid: false,
        tokenRevoked: false,
        tokenExpired: false,
        expected: false,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: false,
        ipValid: true,
        tokenValid: false,
        tokenRevoked: false,
        tokenExpired: false,
        expected: true,
    },
    {
        ipAuthEnabled: false,
        tokenAuthEnabled: true,
        ipValid: false,
        tokenValid: false,
        tokenRevoked: false,
        tokenExpired: false,
        expected: false,
    },
    {
        ipAuthEnabled: false,
        tokenAuthEnabled: true,
        ipValid: true,
        tokenValid: false,
        tokenRevoked: false,
        tokenExpired: false,
        expected: false,
    },
    {
        ipAuthEnabled: false,
        tokenAuthEnabled: true,
        ipValid: false,
        tokenValid: true,
        tokenRevoked: false,
        tokenExpired: false,
        expected: true,
    },
    {
        ipAuthEnabled: false,
        tokenAuthEnabled: true,
        ipValid: false,
        tokenValid: true,
        tokenRevoked: true,
        tokenExpired: false,
        expected: false,
    },
    {
        ipAuthEnabled: false,
        tokenAuthEnabled: true,
        ipValid: false,
        tokenValid: true,
        tokenRevoked: false,
        tokenExpired: true,
        expected: false,
    },
    {
        ipAuthEnabled: false,
        tokenAuthEnabled: true,
        ipValid: false,
        tokenValid: true,
        tokenRevoked: true,
        tokenExpired: true,
        expected: false,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: true,
        ipValid: false,
        tokenValid: false,
        tokenRevoked: false,
        tokenExpired: false,
        expected: false,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: true,
        ipValid: true,
        tokenValid: false,
        tokenRevoked: false,
        tokenExpired: false,
        expected: false,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: true,
        ipValid: true,
        tokenValid: true,
        tokenRevoked: false,
        tokenExpired: false,
        expected: true,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: true,
        ipValid: true,
        tokenValid: true,
        tokenRevoked: true,
        tokenExpired: false,
        expected: false,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: true,
        ipValid: true,
        tokenValid: true,
        tokenRevoked: false,
        tokenExpired: true,
        expected: false,
    },
    {
        ipAuthEnabled: true,
        tokenAuthEnabled: true,
        ipValid: true,
        tokenValid: true,
        tokenRevoked: true,
        tokenExpired: true,
        expected: false,
    },
];

const configObj = {
    auth: {
        ipWhitelist: whitelistedIps,
        publicOperations: ['QUERY'],
    },
};

const getConfig = (ipAuthEnabled, tokenAuthEnabled) => {
    const configClone = JSON.parse(JSON.stringify(configObj));

    configClone.auth.ipBasedAuthEnabled = ipAuthEnabled;
    configClone.auth.tokenBasedAuthEnabled = tokenAuthEnabled;

    return configClone;
};

const getRepository = (isTokenRevoked, tokenAbilitiesValid) =>
    sinon.createStubInstance(RepositoryModuleManager, {
        isTokenRevoked,
        getTokenAbilities: tokenAbilitiesValid ? ['QUERY', 'PUBLISH', 'SEARCH'] : [],
    });

const getIps = (isValid) => {
    if (isValid) {
        return whitelistedIps;
    }

    return invalidIps;
};

const getTokens = (isValid, isExpired) => {
    if (isValid) {
        if (isExpired) {
            return [jwtUtil.generateJWT(uuid(), '-2d')];
        }
        return [jwtUtil.generateJWT(uuid())];
    }

    return invalidTokens;
};

describe('authenticate()', async () => {
    afterEach(() => {
        sinon.restore();
    });

    for (const t of tests) {
        let testText = '';

        for (const field in t) {
            if (field === 'expected') {
                testText += `${field.toUpperCase()}: ${t[field]}`;
            } else {
                testText += `${field}: ${t[field]} | `;
            }
        }

        it(testText, async () => {
            const config = getConfig(t.ipAuthEnabled, t.tokenAuthEnabled);
            const repositoryModuleManager = getRepository(t.tokenRevoked);
            const ips = getIps(t.ipValid);
            const tokens = getTokens(t.tokenValid, t.tokenExpired);
            const authService = new AuthService({ config, repositoryModuleManager });

            for (const ip of ips) {
                for (const token of tokens) {
                    // eslint-disable-next-line no-await-in-loop
                    const isAuthenticated = await authService.authenticate(ip, token);
                    expect(isAuthenticated).to.be.equal(t.expected);
                }
            }
        });
    }

    it('returns false if token is valid but is not found in the database', async () => {
        const config = getConfig(false, true);
        const repositoryModuleManager = getRepository(null, true);
        const [token] = getTokens(true);
        const authService = new AuthService({ config, repositoryModuleManager });

        const isAuthenticated = await authService.authenticate('', token);
        expect(isAuthenticated).to.be.false;
    });
});

describe('isAuthorized()', async () => {
    afterEach(() => {
        sinon.restore();
    });

    it('returns true if tokenBasedAuthentication is disabled', async () => {
        const config = getConfig(false, false);
        const authService = new AuthService({ config });

        const isAuthorized = await authService.isAuthorized(null, null);
        expect(isAuthorized).to.be.equal(true);
    });

    it('returns true if user has ability to perform an action', async () => {
        const config = getConfig(false, true);
        const repositoryModuleManager = getRepository(false, true);
        const jwt = jwtUtil.generateJWT(uuid());
        const authService = new AuthService({ config, repositoryModuleManager });

        const isAuthorized = await authService.isAuthorized(jwt, 'QUERY');
        expect(isAuthorized).to.be.equal(true);
    });

    it("returns false if user doesn't have ability to perform an action", async () => {
        const config = getConfig(false, true);
        const jwt = jwtUtil.generateJWT(uuid());

        const authService = new AuthService({
            config,
            repositoryModuleManager: getRepository(false, true),
        });
        const isAuthorized = await authService.isAuthorized(jwt, 'OPERATION');
        expect(isAuthorized).to.be.equal(false);
    });

    it('returns false if user roles are not found', async () => {
        const config = getConfig(false, true);
        const jwt = jwtUtil.generateJWT(uuid());

        const authService = new AuthService({
            config,
            repositoryModuleManager: getRepository(false, false),
        });

        const isAuthorized = await authService.isAuthorized(jwt, 'PUBLISH');
        expect(isAuthorized).to.be.equal(false);
    });
});

describe('isPublicOperation()', async () => {
    afterEach(() => {
        sinon.restore();
    });

    it('returns true if route is public', async () => {
        const config = getConfig(false, false);
        const authService = new AuthService({ config });

        const isPublic = authService.isPublicOperation('QUERY');
        expect(isPublic).to.be.equal(true);
    });

    it('returns false if route is not public', async () => {
        const config = getConfig(false, false, true);
        const authService = new AuthService({ config });

        const isPublic = authService.isPublicOperation('PUBLISH');
        expect(isPublic).to.be.equal(false);
    });

    it('returns false if public routes are not defined', async () => {
        const config = getConfig(false, false, true);
        config.auth.publicOperations = undefined;
        const authService = new AuthService({ config });

        const isPublic = authService.isPublicOperation('PUBLISH');
        expect(isPublic).to.be.equal(false);
    });
});
