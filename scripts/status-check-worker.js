const { execSync } = require('child_process');
const models = require('../models');
const Models = require('../models/index');
const path = require('path');
const sleep = require('sleep');

process.on('message', async (data) => {
    const { config } = JSON.parse(data);
    models.sequelize.options.storage = path.join(config.appDataPath, 'system.db');
    let isLive = true;
    try {
        do {
            // const supervisorStatus = execSync('supervisorctl status | awk \'{print $1, $2, $6, $7}\'').toString().split('\n');
            const supervisorStatus = 'arango RUNNING 6 days,\notnode RUNNING 6 days,\notnodelistener RUNNING 6 days,\nremote_syslog RUNNING 6 days,'.split('\n');

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
                where: { node_ip: config.high_availability.hostname },
            });
            if (node_status) {
                // eslint-disable-next-line no-await-in-loop
                await Models.node_status.update(
                    updateFields,
                    { where: { node_ip: config.high_availability.hostname } },
                );
            } else {
                // eslint-disable-next-line no-await-in-loop
                await Models.node_status.create({
                    node_ip: config.high_availability.hostname, status, timestamp,
                });
            }

            sleep.sleep(5);
        } while (isLive);
    } catch (e) {
        console.log(e);
        throw Error(e);
    }
});
