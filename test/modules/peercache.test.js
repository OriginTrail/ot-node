require('dotenv').config();
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert } = require('chai');
const os = require('os');
const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');
const PeerCache = require('../../modules/network/kademlia/peer-cache');

const logger = require('../../modules/logger');

/**
 * Dummy contact for testing purposes
 * @type {{hostname: string, protocol: string, port: number}}
 */
const dummyContact = {
    hostname: 'localhost',
    protocol: 'https:',
    port: 5182,
};

/**
 * Simple Kademlia node mock
 */
class NodeMock {
    constructor() {
        this.handlers = {};
        this.router = {
            events: {
                on: (event, callback) => {
                    this.handlers[event] = callback;
                },
            },

            getContactByNodeId() {
                return dummyContact;
            },
        };
        this.logger = logger;
    }

    /**
     * Fire single event (add/remove)
     * @param event
     * @param identity
     */
    fire(event, identity) {
        this.handlers[event](identity);
    }
}

describe('Peercache basic tests', () => {
    let peercache;
    const nodeMock = new NodeMock();
    const peercachePath = `${path.join(os.tmpdir(), 'test.db')}`;

    beforeEach('Setup DB', async () => {
        const fn = PeerCache(`${peercachePath}`);
        peercache = fn(nodeMock);
        logger.debug(`Peercache db created on ${peercachePath}`);
    });

    describe('Test one contact insertion', () => {
        it(
            'should correctly add a contact',
            // eslint-disable-next-line no-loop-func
            async () => {
                await peercache._setExternalPeerInfo(uuidv4(), dummyContact);

                const size = await peercache.getSize();
                assert.equal(size, 1, 'There should be just one contact in peercache');
            },
        );
    });

    describe('Test one contact insertion and deletion', () => {
        it(
            'should correctly add a contact and remove the same one',
            // eslint-disable-next-line no-loop-func
            async () => {
                const id = uuidv4();
                await peercache._setExternalPeerInfo(id, dummyContact);

                let size = await peercache.getSize();
                assert.equal(size, 1, 'There should be just one contact in peercache');

                await peercache._removeExternalPeerInfo(id);

                size = await peercache.getSize();
                assert.equal(size, 0, 'There should be zero contacts in peercache');
            },
        );
    });

    describe('Test many contacts insertion and deletion', () => {
        it(
            'should correctly add many contacts and remove them all',
            // eslint-disable-next-line no-loop-func
            async () => {
                const ids = [];
                const promises = [];
                for (let i = 0; i < 10; i += 1) {
                    const id = uuidv4();
                    ids.push(id);
                    promises.push(peercache._setExternalPeerInfo(id, dummyContact));
                }

                await Promise.all(promises);

                let size = await peercache.getSize();
                assert.equal(size, 10, 'There should be 10 contacts in peercache');

                await Promise.all(ids.map(id => peercache._removeExternalPeerInfo(id)));

                size = await peercache.getSize();
                assert.equal(size, 0, 'There should be zero contacts in peercache');
            },
        );
    });

    afterEach('Drop DB', () => {
        peercache.close();
        fs.unlinkSync(peercachePath);
    });
});
