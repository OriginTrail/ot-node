'use strict';

const { expect } = require('chai');
const { stub } = require('sinon');
const utils = require('../lib/utils');
const constants = require('../lib/constants');


describe('@module utils', function() {

  describe('@function getRandomKeyString', function() {

    it('should return a random hex string', function() {
      expect(utils.getRandomKeyString()).to.have.lengthOf(40);
      expect(utils.getRandomKeyString()).to.not.equal(
        utils.getRandomKeyString()
      );
    });

  });

  describe('@function getRandomKeyBuffer', function() {

    it('should return a B bit random buffer', function() {
      expect(utils.getRandomKeyBuffer()).to.have.lengthOf(constants.B / 8);
      expect(utils.getRandomKeyBuffer()).to.not.equal(
        utils.getRandomKeyBuffer()
      );
    });

  });

  describe('@function keyStringIsValid', function() {

    it('should return true for valid key string', function() {
      expect(utils.keyStringIsValid(
        '765fa7f8bff0872d512a65beed2c2843a4bc7fb5'
      )).to.equal(true);
    });

    it('should return false for valid key string', function() {
      expect(utils.keyStringIsValid(
        'jf;alksduf-0a9sfdaksjd;lfkajs;lkdfjas9df'
      )).to.equal(false);
    });

    it('should return false for valid key string', function() {
      expect(utils.keyStringIsValid('0')).to.equal(false);
    });

  });

  describe('@function keyBufferIsValid', function() {

    it('should return true for valid key buffer', function() {
      expect(utils.keyBufferIsValid(
        Buffer.from('765fa7f8bff0872d512a65beed2c2843a4bc7fb5', 'hex')
      )).to.equal(true);
    });

    it('should return false for valid key string', function() {
      expect(utils.keyBufferIsValid(
        Buffer.from('kf;aslkdjf;alksdjf;aslksa;lkdjf;aslkdjf;', 'utf8')
      )).to.equal(false);
    });

  });

  describe('@function getDistance', function() {

    it('should return the correct distance buffer', function() {
      let keys = [
        [
          [
            'ceb5136e0bf02772b6917543b4e03629bc23a1d8',
            '63e7a67f3a1841c94a433be9c5071651b1923a0c'
          ],
          'ad52b51131e866bbfcd24eaa71e720780db19bd4'
        ],
        [
          [
            'cc0eb01763bcceda0550cc4407eabf5f42ba1673',
            'a8e14ca6a42c1845112b89f24080f70f0dc6d421'
          ],
          '64effcb1c790d69f147b45b6476a48504f7cc252'
        ],
        [
          [
            '9a736bc23d17a8cee12027693e3c6256248ab58b',
            '679ae587e365aeb05dd11fb97dfa1a94cbfb8afe'
          ],
          'fde98e45de72067ebcf138d043c678c2ef713f75'
        ]
      ];
      keys.forEach(([compare, result]) => {
        expect(utils.getDistance(...compare).toString('hex')).to.equal(result);
      });
    });

    it('should return the correct distance buffer', function() {
      let keys = [
        [
          [
            Buffer.from('ceb5136e0bf02772b6917543b4e03629bc23a1d8','hex'),
            Buffer.from('63e7a67f3a1841c94a433be9c5071651b1923a0c', 'hex')
          ],
          'ad52b51131e866bbfcd24eaa71e720780db19bd4'
        ],
        [
          [
            Buffer.from('cc0eb01763bcceda0550cc4407eabf5f42ba1673', 'hex'),
            Buffer.from('a8e14ca6a42c1845112b89f24080f70f0dc6d421', 'hex')
          ],
          '64effcb1c790d69f147b45b6476a48504f7cc252'
        ],
        [
          [
            Buffer.from('9a736bc23d17a8cee12027693e3c6256248ab58b', 'hex'),
            Buffer.from('679ae587e365aeb05dd11fb97dfa1a94cbfb8afe', 'hex')
          ],
          'fde98e45de72067ebcf138d043c678c2ef713f75'
        ]
      ];
      keys.forEach(([compare, result]) => {
        expect(utils.getDistance(...compare).toString('hex')).to.equal(result);
      });
    });
  });

  describe('@function compareKeyBuffers', function() {

    let keys = [
      Buffer.from('c8f53a8431f5412e4303acfb9409b61b56001ee1', 'hex'),
      Buffer.from('4c380b21c28a42d1f64b363d03cd0851fa177cca', 'hex')
    ];

    it('should return 1 for sort function', function() {
      expect(utils.compareKeyBuffers(...keys)).to.equal(1);
    });

    it('should return -1 for sort function', function() {
      expect(utils.compareKeyBuffers(...keys.reverse())).to.equal(-1);
    });

    it('should return 0 for sort function', function() {
      expect(utils.compareKeyBuffers(keys[0], keys[0])).to.equal(0);
      expect(utils.compareKeyBuffers(keys[1], keys[1])).to.equal(0);
    });

  });

  describe('@function getBucketIndex', function() {

    let reference = '6f8901bbfdc23790f02e4593268133c78771109a';
    let testCases = [
      ['bd0fced1cb5692c8bd7cfb4def2112bc53cdbcfb', 159],
      ['28830cc8267086b4b80b2d579a5b48b893622b75', 158],
      ['6fc1c73fd70671c4d2b046ee91029c734959b0cb', 150],
      ['2015bc8a0faf52a5d673981ac119fc3c5e9db4d0', 158],
      ['64d2122805e25ccb4556475a7fcedaf16e0c6697', 155],
      ['6f8901bbec3df42cb187b60cfa0b9de838ce9d8f', 124],
      [reference, 0]
    ];

    it('should return the correct index based on distance', function() {
      testCases.forEach(([foreign, result]) => {
        expect(utils.getBucketIndex(reference, foreign)).to.equal(result);
      });
    });

  });

  describe('@function getPowerOfTwoBufferForIndex', function() {

    let testCases = [
      [
        '65753df5f9e4faa6efc071e15d8f865b35b5677f',
        50,
        '65753df5f9e4faa6efc071e15d04865b35b5677f'
      ],
      [
        'b9eae665761df86d6d8655d0255be793f481c0ba',
        100,
        'b9eae665761df8106d8655d0255be793f481c0ba'
      ],
      [
        Buffer.from('e4c1000352253152453cc069ab9ae71a8bb4e8e8', 'hex'),
        150,
        'e440000352253152453cc069ab9ae71a8bb4e8e8'
      ]
    ];

    it('should return a power of two version of the given key', function() {
      testCases.forEach(([key, index, result]) => {
        expect(
          utils.getPowerOfTwoBufferForIndex(key, index).toString('hex')
        ).to.equal(result);
      });
    });

  });

  describe('@function getRandomBufferInBucketRange', function() {

    let testCases = [
      ['54a1d84e56b0380b7878596cd094804154d8079a', 36],
      ['4cde832be44a98364ac81467521b7ae6e25953e3', 54],
      ['2fdd001069eeacad2881f49058c9e368e994ef51', 71],
      ['48b954272a4cae8e72c7fb5ab681fba7661eeeaf', 98],
      ['65663df335e47def178280607980abac6ced8948', 124],
      ['adde001ace4abe9e30b429914a4510f7226ea2da', 142],
      ['0b182a6f7f5a10641ff94473ff83df96a1493e3d', 158]
    ];

    it('should return a reasonably close random key in range', function() {
      testCases.forEach(([key, index]) => {
        let randomInRange = utils.getRandomBufferInBucketRange(key, index);
        let bucketIndex = utils.getBucketIndex(key, randomInRange);
        expect(Math.abs(index - bucketIndex) <= 7).to.equal(true);
      });
    });

  });

  describe('@function validateStorageAdapter', function() {

    it('should fail if invalid storage adapter', function() {
      expect(function() {
        utils.validateStorageAdapter();
      }).to.throw(Error, 'No storage adapter supplied');
      expect(function() {
        utils.validateStorageAdapter({
          put: stub(),
          del: stub(),
          createReadStream: stub()
        });
      }).to.throw(Error, 'Store has no get method');
      expect(function() {
        utils.validateStorageAdapter({
          get: stub(),
          del: stub(),
          createReadStream: stub()
        });
      }).to.throw(Error, 'Store has no put method');
      expect(function() {
        utils.validateStorageAdapter({
          get: stub(),
          put: stub(),
          createReadStream: stub()
        });
      }).to.throw(Error, 'Store has no del method');
      expect(function() {
        utils.validateStorageAdapter({
          get: stub(),
          put: stub(),
          del: stub(),
        });
      }).to.throw(Error, 'Store has no createReadStream method');
    });

    it('should pass if valid storage adapter', function() {
      expect(function() {
        utils.validateStorageAdapter({
          get: stub(),
          put: stub(),
          del: stub(),
          createReadStream: stub()
        });
      }).to.not.throw(Error);
    });

  });

  describe('@function validateLogger', function() {

    it('should fail if invalid logger', function() {
      expect(function() {
        utils.validateLogger();
      }).to.throw(Error, 'No logger object supplied');
      expect(function() {
        utils.validateLogger({
          info: stub(),
          warn: stub(),
          error: stub()
        });
      }).to.throw(Error, 'Logger has no debug method');
      expect(function() {
        utils.validateLogger({
          debug: stub(),
          warn: stub(),
          error: stub()
        });
      }).to.throw(Error, 'Logger has no info method');
      expect(function() {
        utils.validateLogger({
          debug: stub(),
          info: stub(),
          error: stub()
        });
      }).to.throw(Error, 'Logger has no warn method');
      expect(function() {
        utils.validateLogger({
          debug: stub(),
          info: stub(),
          warn: stub()
        });
      }).to.throw(Error, 'Logger has no error method');
    });

    it('should pass if valid logger', function() {
      expect(function() {
        utils.validateLogger({
          debug: stub(),
          info: stub(),
          warn: stub(),
          error: stub()
        });
      }).to.not.throw(Error);
    });

  });

  describe('@function validateTransport', function() {

    it('should fail if invalid transport', function() {
      expect(function() {
        utils.validateTransport();
      }).to.throw(Error, 'No transport adapter supplied');
      expect(function() {
        utils.validateTransport({ write: stub() });
      }).to.throw(Error, 'Transport has no read method');
      expect(function() {
        utils.validateTransport({ read: stub() });
      }).to.throw(Error, 'Transport has no write method');
    });

    it('should pass if valid transport', function() {
      expect(function() {
        utils.validateTransport({
          read: stub(),
          write: stub()
        });
      }).to.not.throw(Error);
    });

  });

});
