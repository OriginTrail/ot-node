import { createRequire } from 'module';
import { Umzug, SequelizeStorage } from 'umzug';
import { Sequelize } from 'sequelize';
import path from 'path';

const require = createRequire(import.meta.url);

function createMigrator(sequelize, config) {
    return new Umzug({
        migrations: {
            glob: [
                'migrations/*.{js,cjs,mjs}',
                { cwd: path.dirname(import.meta.url.replace('file://', '')) },
            ],
            resolve: (params) => {
                if (params.path.endsWith('.mjs') || params.path.endsWith('.js')) {
                    const getModule = () => import(`file:///${params.path.replace(/\\/g, '/')}`);
                    return {
                        name: params.name,
                        path: params.path,
                        up: async (upParams) => (await getModule()).up(upParams),
                        down: async (downParams) => (await getModule()).down(downParams),
                    };
                }
                return {
                    name: params.name,
                    path: params.path,
                    // eslint-disable-next-line import/no-dynamic-require
                    ...require(params.path),
                };
            },
        },
        context: { queryInterface: sequelize.getQueryInterface(), Sequelize },
        storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
        logger: config.logging ? config.logger : { info: () => {} },
    });
}

export default createMigrator;
