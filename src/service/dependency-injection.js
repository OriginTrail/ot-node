const awilix = require('awilix');

class DependencyInjection {
    static initialize() {
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        container.loadModules(
            [
                'src/controller/**/*.js',
                'src/service/*.js',
                'src/commands/**/**/*.js',
                'src/commands/*.js',
                'src/modules/base-module-manager.js',
                'src/modules/**/*module-manager.js',
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
