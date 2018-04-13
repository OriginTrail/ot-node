'use strict';

/**
 * @class
 */
class ErrorRules {

  /**
   * Constructs a error rules instance in the context of a
   * {@link AbstractNode}
   * @constructor
   * @param {AbstractNode} node
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * Assumes if no error object exists, then there is simply no method defined
   * @param {error|null} error
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   * @param {AbstractNode~next} next
   */
  methodNotFound(err, request, response, next) {
    if (err) {
      return next();
    }

    response.error('Method not found', -32601);
  }

  /**
   * Formats the errors response according to the error object given
   * @param {error|null} error
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   * @param {AbstractNode~next} next
   */
  internalError(err, request, response, next) {
    response.error(err.message, err.code || -32603);
    next()
  }

}

module.exports = ErrorRules;
