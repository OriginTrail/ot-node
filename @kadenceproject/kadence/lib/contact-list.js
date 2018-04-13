'use strict';

const utils = require('./utils');

/**
 * Manages contact lists returned from FIND_NODE queries
 */
class ContactList {

  /**
   * @constructor
   * @param {string} key - Lookup key for this operation
   * @param {Bucket~contact[]} contacts - List of contacts to initialize with
   */
  constructor(key, contacts = []) {
    this.key = key;
    this._contacts = [];
    this._contacted = new Set();
    this._active = new Set();

    this.add(contacts);
  }

  /**
   * @property {Bucket~contact} closest - The contact closest to the reference key
   */
  get closest() {
    return this._contacts[0];
  }

  /**
   * @property {Bucket~contact[]} active - Contacts in the list that are active
   */
  get active() {
    return this._contacts.filter( contact => this._active.has(contact[0]));
  }

  /**
   * @property {Bucket~contact[]} uncontacted - Contacts in the list that have not been
   * contacted
   */
  get uncontacted() {
    return this._contacts.filter( contact => !this._contacted.has(contact[0]));
  }

  /**
   * Adds the given contacts to the list
   * @param {Bucket~contact[]} contacts
   */
  add(contacts) {
    let identities = this._contacts.map(c => c[0]);
    let added = [];

    contacts.forEach( contact => {
      if (identities.indexOf(contact[0]) === -1) {
        this._contacts.push(contact);
        identities.push(contact[0]);
        added.push(contact);
      }
    });

    this._contacts.sort(this._identitySort.bind(this));

    return added;
  }

  /**
   * Marks the supplied contact as contacted
   * @param {Bucket~contact} contact
   */
  contacted(contact) {
    this._contacted.add(contact[0]);
  }

  /**
   * Marks the supplied contact as active
   * @param {Bucket~contact} contact
   */
  responded(contact) {
    this._active.add(contact[0]);
  }

  /**
   * @private
   */
  _identitySort([aIdentity], [bIdentity]) {
    return utils.compareKeyBuffers(
      Buffer.from(utils.getDistance(aIdentity, this.key), 'hex'),
      Buffer.from(utils.getDistance(bIdentity, this.key), 'hex')
    );
  }

}

module.exports = ContactList;
