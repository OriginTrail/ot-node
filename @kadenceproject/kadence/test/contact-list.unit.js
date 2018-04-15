'use strict';

const { expect } = require('chai');
const ContactList = require('../lib/contact-list');

describe('@class ContactList', function() {
  describe('@property closest', function() {
    it('returns the closest node to the key', function() {
      let contact = { hostname: 'localhost', port: 8080 };
      let shortlist = new ContactList(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact]
        ]
      );
      expect(shortlist.closest[0]).to.equal(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127'
      );
    });
  });

  describe('@property active', function() {
    it('returns nodes that have responded', function() {
      let contact = { hostname: 'localhost', port: 8080 };
      let shortlist = new ContactList(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact]
        ]
      );
      shortlist.responded(
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact]
      );
      expect(shortlist.active.length).to.equal(1);
      expect(shortlist.active).to.deep.equal(
        [['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact]]
      );
    });
  });

  describe('@property uncontacted', function() {
    it('returns uncontacted nodes', function() {
      let contact = { hostname: 'localhost', port: 8080 };
      let shortlist = new ContactList(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact]
        ]
      );
      shortlist.contacted(
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact]
      );
      expect(shortlist.uncontacted.length).to.equal(2);
      expect(shortlist.uncontacted).to.not.deep.include(
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact]
      );
    });
  });

  describe('@method add', function() {
    it('adds new nodes in distance order', function() {
      let contact = { hostname: 'localhost', port: 8080 };
      let shortlist = new ContactList(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact]
        ]
      );
      shortlist.add(
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc124', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc129', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc123', contact]
        ]
      );
      expect(shortlist.closest[0]).to.equal(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127'
      );
      expect(shortlist._contacts.slice(-1)[0][0]).to.equal(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc129'
      );
    });

    it('does not insert duplicates', function() {
      let contact = { hostname: 'localhost', port: 8080 };
      let shortlist = new ContactList(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact]
        ]
      );
      shortlist.add(
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact]
        ]
      );
      expect(shortlist._contacts.length).to.equal(3);
    });

    it('returns the inserted nodes', function() {
      let contact = { hostname: 'localhost', port: 8080 };
      let shortlist = new ContactList(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact]
        ]
      );
      let added = shortlist.add(
        [
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
          ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc129', contact]
        ]
      );
      expect(added.length).to.equal(1);
      expect(added[0][0]).to.equal('ea48d3f07a5241291ed0b4cab6483fa8b8fcc129');
    });
  });
});