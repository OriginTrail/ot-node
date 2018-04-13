'use strict'

const { expect } = require('chai');
const Bucket = require('../lib/bucket');


describe('@class Bucket', function() {

  const bucket = new Bucket();
  const entries = [
    '0000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000001',
    '0000000000000000000000000000000000000002',
    '0000000000000000000000000000000000000003',
    '0000000000000000000000000000000000000004',
    '0000000000000000000000000000000000000005',
    '0000000000000000000000000000000000000006',
    '0000000000000000000000000000000000000007',
    '0000000000000000000000000000000000000008',
    '0000000000000000000000000000000000000009',
    '0000000000000000000000000000000000000010',
    '0000000000000000000000000000000000000011',
    '0000000000000000000000000000000000000012',
    '0000000000000000000000000000000000000013',
    '0000000000000000000000000000000000000014',
    '0000000000000000000000000000000000000015',
    '0000000000000000000000000000000000000016',
    '0000000000000000000000000000000000000017',
    '0000000000000000000000000000000000000018',
    '0000000000000000000000000000000000000019'
  ];

  describe('@method set', function() {

    it('should add each entry to the head', function() {
      entries.forEach((entry) => bucket.set(entry, entry));
      [...bucket.keys()].forEach((key, i) => {
        expect(entries.indexOf(key)).to.equal(entries.length - (i + 1));
      });
    });

    it('should move existing contacts to the tail', function() {
      bucket.set(entries[4], entries[4]);
      expect([...bucket.keys()].pop()).to.equal(entries[4]);
    });

    it('should not add new contacts if bucket is full', function() {
      expect(
        bucket.set('0000000000000000000000000000000000000020')
      ).to.equal(-1);
    });

  });

  describe('@method indexOf', function() {

    it('should return -1 if not found', function() {
      expect(bucket.indexOf('NOTVALIDKEY')).to.equal(-1);
    });

    it('should return the correct index', function() {
      expect(bucket.indexOf(entries[6])).to.equal(13);
      expect(bucket.indexOf(entries[4])).to.equal(19);
      expect(bucket.indexOf(entries[19])).to.equal(0);
    });

  });

  describe('@method getClosestToKey', function() {

    it('should return a sorted list of contacts by distance', function() {
      expect(JSON.stringify(
        [
          ...bucket.getClosestToKey(
            '0000000000000000000000000000000000000010'
          ).keys()
        ]
      )).to.equal(JSON.stringify([
        '0000000000000000000000000000000000000011',
        '0000000000000000000000000000000000000012',
        '0000000000000000000000000000000000000013',
        '0000000000000000000000000000000000000014',
        '0000000000000000000000000000000000000015',
        '0000000000000000000000000000000000000016',
        '0000000000000000000000000000000000000017',
        '0000000000000000000000000000000000000018',
        '0000000000000000000000000000000000000019',
        '0000000000000000000000000000000000000000',
        '0000000000000000000000000000000000000001',
        '0000000000000000000000000000000000000002',
        '0000000000000000000000000000000000000003',
        '0000000000000000000000000000000000000004',
        '0000000000000000000000000000000000000005',
        '0000000000000000000000000000000000000006',
        '0000000000000000000000000000000000000007',
        '0000000000000000000000000000000000000008',
        '0000000000000000000000000000000000000009'
      ]));
    });

  });

  describe('@property length', function() {

    it('should alias the size property', function() {
      expect(bucket.length).to.equal(bucket.size);
      expect(bucket.length).to.equal(20);
    });

  });

  describe('@property head', function() {

    it('should return the head contact', function() {
      expect(bucket.head[0]).to.equal(
        '0000000000000000000000000000000000000019'
      );
    });

  });

  describe('@property tail', function() {

    it('should return the tail contact', function() {
      expect(bucket.tail[0]).to.equal(
        '0000000000000000000000000000000000000004'
      );
    });

  });

});
