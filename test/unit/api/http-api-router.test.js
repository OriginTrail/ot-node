import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import HttpApiRouter from '../../../src/controllers/http-api/http-api-router.js';
import JsonSchemaServiceMock from '../mock/json-schema-service-mock.js';
import HttpClientModuleManagerMock from '../mock/http-client-module-manager-mock.js';
import { HTTP_API_ROUTES } from '../../../src/constants/constants.js';

describe('HTTP API Router test', async () => {
    let httpApiRouter;
    const controllerMocks = {};

    beforeEach(() => {
        // Mock Controllers
        Object.keys(HTTP_API_ROUTES).forEach((version) => {
            Object.keys(HTTP_API_ROUTES[version]).forEach((operation) => {
                const versionedController = `${operation}HttpApiController${
                    version.charAt(1).toUpperCase() + version.slice(2)
                }`;
                controllerMocks[versionedController] = { handleRequest: sinon.stub() };
            });
        });

        // Mock context
        const ctx = {
            httpClientModuleManager: new HttpClientModuleManagerMock(),
            jsonSchemaService: new JsonSchemaServiceMock(),
            ...controllerMocks,
        };

        // Initialize HttpApiRouter with mocks
        httpApiRouter = new HttpApiRouter(ctx);
    });

    it('Router has all defined routes', async () => {
        // Extract unique HTTP methods present across all versions
        const httpMethods = new Set();
        Object.values(HTTP_API_ROUTES).forEach((routes) => {
            Object.values(routes).forEach((route) => {
                httpMethods.add(route.method);
            });
        });

        // Create spies for each extracted HTTP method on each router instance and httpClientModuleManager
        const spies = {};
        Object.keys(HTTP_API_ROUTES).forEach((version) => {
            spies[version] = {};
            Array.from(httpMethods).forEach((method) => {
                spies[version][method] = sinon.spy(httpApiRouter.routers[version], method);
            });
        });
        const httpClientModuleManagerUseSpy = sinon.spy(
            httpApiRouter.httpClientModuleManager,
            'use',
        );

        // Initialize the routes
        await httpApiRouter.initialize();

        // Validate each route
        Object.entries(HTTP_API_ROUTES).forEach(([version, routes]) => {
            expect(httpClientModuleManagerUseSpy.calledWith(`/${version}`)).to.equal(true);

            Object.values(routes).forEach((routeDetails) => {
                const { method, path } = routeDetails;
                expect(spies[version][method].calledWith(path)).to.equal(true);
            });
        });
        expect(httpClientModuleManagerUseSpy.calledWith('/latest')).to.equal(true);
        expect(httpClientModuleManagerUseSpy.calledWith('/')).to.equal(true);

        // Restore all spies
        Object.values(spies).forEach((versionSpies) => {
            Object.values(versionSpies).forEach((spy) => {
                spy.restore();
            });
        });
        httpClientModuleManagerUseSpy.restore();
    });
});
