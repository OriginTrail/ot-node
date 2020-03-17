'use strict';

const kadence = require('@deadcanaries/kadence');
const async = require('async');
const fs = require('fs');
const uuid = require('uuid');

class BroadcastPlugin extends kadence.quasar.QuasarPlugin {
    constructor(quasar) {
        super(quasar);
    }

    publish(request, response, next) {
        /* eslint max-statements: [2, 18] */
        const {
            ttl, topic, uuid, contents,
        } = request.params;
        const neighbors = [];

        const bucketRange = kadence.constants.B - contents.broadcastDistance;
        for (let i = 1; i < bucketRange; i += 1) {
            const contact = super.quasar.node.router.getRandomContact(i);
            if (contact != null) { neighbors.push(contact); }
        }

        if (super.quasar.cached.get(uuid)) {
            return next(new Error('Message previously routed'));
        }

        if (ttl > kadence.constants.MAX_RELAY_HOPS || ttl < 0) {
            return next(new Error('Message includes invalid TTL'));
        }

        request.params.publishers.push(super.quasar.node.identity.toString('hex'));
        super.quasar.cached.set(uuid, Date.now());

        if (super.quasar.isSubscribedTo(topic)) {
            super.quasar.groups.get(topic)(contents, topic);
            async.each(neighbors, (contact, done) => {
                console.log(`Forward to: ${contact[0]}`);

                const broadcastDir = request.params.contents.broadcastDir;

                if (!fs.existsSync(`${broadcastDir}`)) {
                    fs.mkdirSync(`${broadcastDir}`);
                }

                if (!fs.existsSync(`${broadcastDir}/${super.quasar.node.identity.toString('hex')}.json`)) {
                    fs.writeFileSync(`${broadcastDir}/${super.quasar.node.identity.toString('hex')}.json`, '[]');
                }
                const forwardArray = JSON.parse(fs.readFileSync(`${broadcastDir}/${super.quasar.node.identity.toString('hex')}.json`));
                forwardArray.push(contact[0]);
                fs.writeFileSync(`${broadcastDir}/${super.quasar.node.identity.toString('hex')}.json`, JSON.stringify(forwardArray));

                request.params.contents.broadcastDistance = kadence.constants.B - kadence.utils.getBucketIndex(super.quasar.node.identity.toString('hex'), contact[0]);
                super._relayPublication(request, contact, done);
            });
            return response.send([]);
        }

        if (ttl - 1 === 0) {
            return response.send([]);
        }

        async.each(neighbors, (contact, done) => {
            super.quasar.pullFilterFrom(contact, (err, filter) => {
                if (err) {
                    return done();
                }

                if (!super.shouldRelayPublication(request, filter)) {
                    contact = super.quasar._getRandomContact();
                }
                // console.log("Forward to: "+contact[0]);
                super._relayPublication(request, contact, done);
            });
        });
        response.send([]);
    }
}

class BroadcastRules extends kadence.quasar.QuasarRules {
    constructor(node) {
        super(node);
    }

    quasarPublish(topic, contents, options = {}, callback = () => null) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        const publicationId = uuid.v4();
        const neighbors = [];

        for (let i = 1; i < kadence.constants.B; i += 1) {
            const contact = this.node.router.getRandomContact(i);
            if (contact != null) { neighbors.push(contact); }
        }

        const deliveries = [];
        let retries = 3;

        // console.log(JSON.stringify(neighbors));

        async.until(() => retries === 0 || !neighbors.length, (done) => {
            const candidates = [];
            retries -= 1;

            for (let i = 0; i < neighbors.length; i++) {
                candidates.push(neighbors.shift());
            }


            async.each(candidates, (contact, next) => {
                contents.broadcastDistance = kadence.constants.B - kadence.utils.getBucketIndex(this.node.router.identity, contact[0]);
                this.node.send(kadence.QuasarPlugin.PUBLISH_METHOD, {
                    uuid: publicationId,
                    topic,
                    contents,
                    publishers: [this.node.identity.toString('hex')],
                    ttl: kadence.constants.MAX_RELAY_HOPS,
                }, contact, (err) => {
                    if (err) {
                        this.node.logger.warn(err.message);
                    } else {
                        // console.log("Forward to: "+contact[0]);
                        deliveries.push(contact);
                    }

                    next();
                });
            }, done);
        }, (err) => {
            if (!err && deliveries.length === 0) {
                err = new Error('Failed to deliver any publication messages');
            }

            callback(err, deliveries);
        });
    }
}

module.exports = function () {
    return function (node) {
        return new BroadcastPlugin(node);
    };
};


module.exports.BroadcastPlugin = BroadcastPlugin;
module.exports.BroadcastRules = BroadcastRules;
