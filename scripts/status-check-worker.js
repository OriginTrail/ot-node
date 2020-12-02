const { execSync } = require('child_process');
const models = require('../models');
const Models = require('../models/index');
const path = require('path');

process.on('message', async (data) => {
    const { config } = JSON.parse(data);
    models.sequelize.options.storage = path.join(config.appDataPath, 'system.db');
    let isLive = true;
    try {
        do {
            const supervisorStatus = execSync('supervisorctl status | awk \'{print $1, $2, $6, $7}\'').toString().split('\n');
            // const supervisorStatus = 'arango RUNNING 6 days,\notnode RUNNING 6 days,
            // \notnodelistener RUNNING 6 days,\nremote_syslog RUNNING 6 days,'.split('\n');
            console.log(`Reveived supervisor status ${JSON.stringify(supervisorStatus)}`);
            for (let i = 1; i < supervisorStatus.length; i += 1) {
                const status = supervisorStatus[i].split(' ');
                if (['otnode', 'arango'].includes(status[0])) {
                    if (status[1] !== 'RUNNING') {
                        isLive = false;
                        break;
                    }
                }
            }

            const timestamp = new Date();
            const status = isLive ? 'RUNNING' : 'WAITING';
            const updateFields = isLive ? { status, timestamp } : { status };
            // eslint-disable-next-line no-await-in-loop
            const node_status = await Models.node_status.findOne({
                where: { hostname: config.high_availability.private_hostname },
            });
            if (node_status) {
                // eslint-disable-next-line no-await-in-loop
                await Models.node_status.update(
                    updateFields,
                    { where: { hostname: config.high_availability.private_hostname } },
                );
            } else {
                // eslint-disable-next-line no-await-in-loop
                await Models.node_status.create({
                    hostname: config.high_availability.private_hostname, status, timestamp,
                });
            }

            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve, reject) => {
                setTimeout(() => resolve('done!'), 5000);
            });
        } while (isLive);
        process.exit(0);
    } catch (e) {
        process.send({ error: `${e.message}\n${e.stack}` }, () => {
            process.exit(0);
        });
    }
});

process.once('SIGTERM', () => process.exit(0));
