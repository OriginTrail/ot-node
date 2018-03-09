'use strict';
const describe = require('mocha').describe;
const it = require('mocha').it;
// eslint-disable-next-line no-unused-vars
const should = require('should');
// eslint-disable-next-line no-unused-vars
const request = require('supertest');
const utilities = require('../../modules/utilities')();
// eslint-disable-next-line no-unused-vars
const config = utilities.getConfig();


describe('The Utilities', () => {
	// it('config should exist', () => {
	// 	let config = utilities.getConfig();
	// 	should.exist(config);
	// 	config.should.be.an.Object;
	// 	(function () {
	// 		JSON.stringify(config);
	// 	}).should.not.throw();
	// 	should.exist(config.NODE_IP);
	// 	config.NODE_IP.should.not.be.empty();
	// });

	it('should return true if it is an empty object', () => {
		let obj2 = {};
		let result = utilities.isEmptyObject(obj2);
		result.should.be.true();
	});

	it('should return false if is not an empty object', () => {
		let obj1 = {
			'name': 'OriginTrail'
		};
		let result = utilities.isEmptyObject(obj1);
		result.should.be.false();
	});

	it('should return random number', () => {
		let number = utilities.getRandomInt(10);
		number.should.be.an.Number;
		number.should.be.belowOrEqual(10);
	});

	it('should return true if two IP addresses are the same', () => {
		let ip1 = '127.0.0.1';
		let ip2 = '127.0.0.1';
		let result = utilities.isIpEqual(ip1, ip2);
		result.should.be.true;
	});
	it('should return false if two IP addresses are not the same', () => {
		let ip1 = '127.0.0.1';
		let ip2 = '192.168.0.0';
		let result = utilities.isIpEqual(ip1, ip2);
		result.should.be.false;
	});


});