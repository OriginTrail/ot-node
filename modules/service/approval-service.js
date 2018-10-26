const fs = require('fs');
const BN = require('bn.js');
const path = require('path');

const Utilities = require('../Utilities');

class ApprovalService {
    /**
     * Default constructor
     * @param ctx
     */
    constructor(ctx) {
        this.blockchain = ctx.blockchain;
        this.approvedNodes = [];
    }

    /**
     * Load all nodes currently approved for functioning on the network
     */
    async initialize() {
        this.approvedNodes = await this.blockchain.getApprovedNodes();
    }

    /**
     * Return all nodes currently approved for functioning on the network
     */
    async getApprovedNodes() {
        return this.approvedNodes;
    }

    /**
     * Return all nodes currently approved for functioning on the network
     */
    async addApprovedNode(nodeId) {
        this.approvedNodes.push(nodeId);
    }

    isApproved(nodeId) {
        return this.approvedNodes.contains(nodeId);
    }
}

module.exports = ApprovalService;
