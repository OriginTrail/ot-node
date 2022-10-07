import awilix from 'awilix';

class DependencyInjection {
    static async initialize() {
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        await container.loadModules(
            [
                'src/controllers/**/*.js',
                'src/service/*.js',
                'src/commands/**/**/**/*.js',
                'src/commands/*.js',
                'src/modules/base-module-manager.js',
                'src/modules/**/*module-manager.js',
            ],
            {
                esModules: true,
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

export default DependencyInjection;
