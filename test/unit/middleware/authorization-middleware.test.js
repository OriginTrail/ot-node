const sinon = require('sinon');
const { describe, it, afterEach } = require('mocha');
const { expect } = require('chai');

const authorizationMiddleware = require('../../../src/modules/http-client/implementation/middleware/authorization-middleware');
const AuthService = require('../../../src/service/auth-service');

describe('authentication middleware test', async () => {
    const sandbox = sinon.createSandbox();

    const getAuthService = (options) =>
        sandbox.createStubInstance(AuthService, {
            authenticate: options.isAuthenticated,
            isAuthorized: options.isAuthorized,
            isPublicAction: options.isPublicAction,
        });

    afterEach(() => {
        sandbox.restore();
    });

    it('calls next if isPublic route is set to true', async () => {
        const middleware = authorizationMiddleware(
            getAuthService({
                isPublicAction: true,
            }),
        );

        const req = { headers: { authorization: 'Bearer token' }, url: '/publish' };

        const spySend = sandbox.spy();
        const spyStatus = sandbox.spy(() => ({ send: spySend }));

        const nextSpy = sandbox.spy();
        await middleware(req, { status: spyStatus }, nextSpy);

        expect(nextSpy.calledOnce).to.be.true;
        expect(spyStatus.notCalled).to.be.true;
        expect(spySend.notCalled).to.be.true;
    });

    it('calls next if isAuthenticated is evaluated as true', async () => {
        const middleware = authorizationMiddleware(
            getAuthService({
                isPublicAction: true,
            }),
        );

        const req = { headers: { authorization: 'Bearer token' }, url: '/publish' };

        const spySend = sandbox.spy();
        const spyStatus = sandbox.spy(() => ({ send: spySend }));

        const nextSpy = sandbox.spy();
        await middleware(req, { status: spyStatus }, nextSpy);

        expect(nextSpy.calledOnce).to.be.true;
        expect(spyStatus.notCalled).to.be.true;
        expect(spySend.notCalled).to.be.true;
    });

    it('returns 403 if isAuthenticated is evaluated as false', async () => {
        const middleware = authorizationMiddleware(
            getAuthService({
                isPublicAction: false,
                isAuthenticated: false,
            }),
        );

        const req = { headers: { authorization: 'Bearer token' }, url: '/publish' };

        const spySend = sandbox.spy();
        const spyStatus = sandbox.spy(() => ({ send: spySend }));
        const spyNext = sandbox.spy();

        await middleware(req, { status: spyStatus }, spyNext);

        const [statusCode] = spyStatus.args[0];
        expect(statusCode).to.be.eq(403);
        expect(spyStatus.calledOnce).to.be.true;
        expect(spySend.calledOnce).to.be.true;
        expect(spyNext.notCalled).to.be.true;
    });
});
