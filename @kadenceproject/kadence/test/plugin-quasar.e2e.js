'use strict';

const async = require('async');
const kadence = require('..');
const quasar = require('../lib/plugin-quasar');
const network = require('./fixtures/node-generator');


const TOTAL_NODES = 12;

describe('@module kadence/quasar + @class UDPTransport', function() {

  this.timeout(400000);

  let nodes, seed;

  let topics = {
    topic1: (TOTAL_NODES - 1) / 4,
    topic2: (TOTAL_NODES - 1) / 4,
    topic3: (TOTAL_NODES - 1) / 4,
    topic4: (TOTAL_NODES - 1) / 4
  };

  before(function(done) {
    nodes = network(TOTAL_NODES, kadence.UDPTransport);
    async.each(nodes, (node, done) => {
      node.plugin(quasar());
      node.listen(node.contact.port, node.contact.hostname, done);
    }, () => {
      seed = nodes.shift();
      nodes.forEach((node) => {
        seed.router.addContactByNodeId(
          node.identity.toString('hex'),
          node.contact
        );
      });
      async.each(nodes, (node, done) => node.join([
        seed.identity.toString('hex'),
        seed.contact
      ], done), done);
    });
  });

  after(function() {
    nodes.forEach((node) => node.transport.socket.close());
  });

  it('nodes subscribed to a topic should receive publication', function(done) {
    let topicCounter = 0;
    function getTopicName() {
      if (topicCounter === 0 || topicCounter < 4) {
        return 'topic' + (++topicCounter);
      } else {
        topicCounter = 0;
        return getTopicName();
      }
    }
    function confirmPublicationReceipt(topic) {
      topics[topic]--;
      for (let t in topics) {
        if (topics[t] > 0) {
          return;
        }
      }
      done();
    }
    async.eachLimit(nodes, 4, (node, next) => {
      let topic = getTopicName();
      node.quasarSubscribe(topic, () => confirmPublicationReceipt(topic));
      setTimeout(() => next(), 500);
    }, () => {
      let publishers = nodes.splice(0, 4);
      async.each(publishers, (node, done) => {
        node.quasarPublish(getTopicName(), {}, done);
      }, () => {
        setTimeout(() => {
          let totalMembersRemaining = 0;
          for (let t in topics) {
            totalMembersRemaining += topics[t];
          }
          if (totalMembersRemaining > Math.floor((TOTAL_NODES - 1) * 0.15)) {
            return done(new Error(
              `${totalMembersRemaining} group members did not get message`
            ));
          }
          done();
        }, 12000);
      });
    });
  });

});
