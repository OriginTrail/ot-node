'use strict';

const { expect } = require('chai');
const utils = require('../lib/utils');
const constants = require('../lib/constants');
const RoutingTable = require('../lib/routing-table');


describe('@class RoutingTable', function() {

  describe('@constructor', function() {

    it('should use the given identity and create B buckets', function() {
      let identity = utils.getRandomKeyBuffer();
      let router = new RoutingTable(identity);
      expect(router.identity).to.equal(identity);
      expect([...router.entries()]).to.have.lengthOf(constants.B);
    });

  });

  describe('@property size', function() {

    it('should return the total contacts across all buckets', function() {
      let router = new RoutingTable();
      let contacts = 20;
      let counter = 0;
      while (counter < contacts) {
        router.addContactByNodeId(utils.getRandomKeyString(), {});
        counter++;
      }
      expect(router.size).to.equal(contacts);
    });

  });

  describe('@property length', function() {

    it('should return the number of buckets', function() {
      let router = new RoutingTable();
      expect(router.length).to.equal(constants.B);
    });

  });

  describe('@method indexOf', function() {

    it('should return the bucket index for the given contact', function() {
      let router = new RoutingTable();
      let nodeId = utils.getRandomKeyString();
      let [bucketIndex] = router.addContactByNodeId(nodeId, {});
      expect(router.indexOf(nodeId)).to.equal(bucketIndex);
    });

  });

  describe('@method getContactByNodeId', function() {

    it('should return the contact object by node id', function() {
      let router = new RoutingTable();
      let nodeId = utils.getRandomKeyString();
      let contactObj = { hostname: 'localhost', port: 8080 };
      router.addContactByNodeId(nodeId, contactObj);
      expect(router.getContactByNodeId(nodeId)).to.equal(contactObj);
    });

  });

  describe('@method removeContactByNodeId', function() {

    it('should remove the contact object by node id', function() {
      let router = new RoutingTable();
      let nodeId = utils.getRandomKeyString();
      let contactObj = { hostname: 'localhost', port: 8080 };
      router.addContactByNodeId(nodeId, contactObj);
      router.removeContactByNodeId(nodeId);
      expect(router.getContactByNodeId(nodeId)).to.equal(undefined);
    });

  });

  describe('@method addContactByNodeId', function() {

    it('shoulod add the contact to the appropriate bucket', function() {
      let identity = Buffer.from('ab61ae6158346ec83b178f389d1574589f86dd4e',
                                 'hex');
      let nodeId = Buffer.from('c22e091488e9502c09f7c9f8115f386253148a38',
                               'hex');
      let router = new RoutingTable(identity);
      let [bucketIndex] = router.addContactByNodeId(nodeId, {});
      expect(bucketIndex).to.equal(158);
    });

  });

  describe('@method getClosestBucket', function() {

    it('should return the lowest occupied bucket', function() {
      let router = new RoutingTable();
      router.get(10).set('0', {});
      router.get(20).set('1', {});
      router.get(50).set('2', {});
      router.get(140).set('3', {});
      expect(router.getClosestBucket()[0]).to.equal(10);
      expect(router.getClosestBucket()[1]).to.equal(router.get(10));
    });

  });

  describe('@method getClosestContactsToKey', function() {

    it('should return the contacts closest to the key', function() {
      let identity = Buffer.from('9e64985b4256a273614165ee75a26076ed8ee5df',
                                 'hex');
      let router = new RoutingTable(identity);
      let contacts = [
        'ca284a43d8e3028eefeb0fde889b4cab0953d799',
        '0093f9f3b8435e6eac92a4651241c8463420c9e1',
        '8724a5e6251cff03f09616cb142c60398a4f2c8d',
        'db61a7f76abe933e8f949150a27ace0df9278706',
        'e9a951fe6e6f5eb0ff1c02a49bd7339d2d07ff75',
        '0f3e8bc3ae0bfd4e204fbf1e06ff042d485c32b7',
        '72ea79157be0ddfb0404e0ae35a1df10d382f900',
        '536496314bb9b26b89e409ebe80956ca0d5081da',
        '056ca971e4714ee25b7c08cb64b748d812918a7d',
        '52b16f4d2c53e32a06086ea7a57cf48112dcd370',
        '3bc5ceb7e3f0ea4587a430f88145aa9ef4bdc3c4',
        'efbd1cfedcc0d0215b6c4a500bfeeaf96f77d98c',
        'a5eeda3fc29fa699d252f21a820ea161870bc021',
        '20baafefa205bfed00bca8356ec0c65bbefeac18',
        '08c7cfd5eecded3bc32b94e908cfc5ec59094cc7',
        'e120819a5392b44a5a7a77725de0e50c33dac099',
        'ca6facc2445dbb615dedab4ac0d4dce838d192cf',
        'ed4b23470abd66d8466db8f7d097a6726a52ceb7',
        '784c30f33b9b703bf87b0622823f5c7142628438',
        'c1bb8a8a74135e936115af58b7057122582caff7',
        '2a3e0e87d1591b08e951fd03cecb06e652fef628',
        '35d7aa4cc240b47e3af901b9ea764725aa4dd15c',
        '41bb17f1ec4e8dc84f975f648b4d1e2794474df9',
        'a5c59b275121762079cdfa5aa6f89c9aab3893af',
        'f8608e690d64f66639d5b54a0efd87ac89d97148'
      ];
      let key = '9e6498b8f241d8ec1eaf33110b12451f224fa444';
      contacts.forEach((id) => router.addContactByNodeId(id, { id }))
      let closest = [...router.getClosestContactsToKey(key).keys()];
      expect(contacts.indexOf(closest[0])).to.equal(2);
      expect(contacts.indexOf(closest[1])).to.equal(12);
      expect(contacts.indexOf(closest[2])).to.equal(23);
      expect(contacts.indexOf(closest[3])).to.equal(3);
      expect(contacts.indexOf(closest[4])).to.equal(16);
      expect(contacts.indexOf(closest[5])).to.equal(0);
      expect(contacts.indexOf(closest[6])).to.equal(19);
      expect(contacts.indexOf(closest[7])).to.equal(24);
      expect(contacts.indexOf(closest[8])).to.equal(11);
      expect(contacts.indexOf(closest[9])).to.equal(17);
      expect(contacts.indexOf(closest[10])).to.equal(4);
      expect(contacts.indexOf(closest[11])).to.equal(15);
      expect(contacts.indexOf(closest[12])).to.equal(5);
      expect(contacts.indexOf(closest[13])).to.equal(14);
      expect(contacts.indexOf(closest[14])).to.equal(8);
      expect(contacts.indexOf(closest[15])).to.equal(1);
      expect(contacts.indexOf(closest[16])).to.equal(10);
      expect(contacts.indexOf(closest[17])).to.equal(21);
      expect(contacts.indexOf(closest[18])).to.equal(20);
      expect(contacts.indexOf(closest[19])).to.equal(13);
    });

  });

});
