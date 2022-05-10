const awilix = require('awilix');
const path = require('path');
const appRootPath = require('app-root-path');

class DependencyInjection {
    static initialize() {
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        container.loadModules(
            [
                path.join(appRootPath.path, 'modules/controller/**/*.js'),
                path.join(appRootPath.path, 'modules/service/**/*.js'),
                path.join(appRootPath.path, 'modules/command/**/*.js'),
                path.join(appRootPath.path, 'modules/manager/**/*.js'),
                path.join(appRootPath.path, 'modules/worker/worker-pool.js'),
                path.join(appRootPath.path, 'src/controller/**/*.js'),
                path.join(appRootPath.path, 'src/modules/base-module-manager.js'),
                path.join(appRootPath.path, 'src/modules/**/*module-manager.js'),
            ],
            {
                formatName: 'camelCase',
                resolverOptions: {
                    lifetime: awilix.Lifetime.SINGLETON,
                    register: awilix.asClass,
                },
            },
        );

        return container;
    }

    static registerValue(container, valueName, value) {
        container.register({
            [valueName]: awilix.asValue(value),
        });
    }
}

module.exports = DependencyInjection;
