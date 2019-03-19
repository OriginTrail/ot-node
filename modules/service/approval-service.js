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
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.approvedNodes = [];
    }

    /**
     * Load all nodes currently approved for functioning on the network
     */
    async initialize() {
        const allNodes = await this.blockchain.getAddedNodes();
        const nodeApproved = await this.blockchain.getNodeStatuses();
        const approvedNodes = [];

        for (let i = 0; i < allNodes.length; i += 1) {
            if (nodeApproved[i] === true) {
                allNodes[i] = allNodes[i].toLowerCase();
                allNodes[i] = Utilities.normalizeHex(allNodes[i]);
                if (allNodes[i].length > 42) {
                    allNodes[i] = allNodes[i].substr(-40, 40);
                    allNodes[i] = Utilities.normalizeHex(allNodes[i]);
                }
                if (approvedNodes.indexOf(allNodes[i]) === -1) {
                    approvedNodes.push(allNodes[i]);
                }
            }
        }
        this.approvedNodes = approvedNodes;
    }

    /**
     * Return all nodes currently approved for functioning on the network
     */
    getApprovedNodes() {
        return this.approvedNodes;
    }

    /**
     * Add a single node to the approved nodes
     * @param nodeId
     */
    addApprovedNode(nodeId) {
        nodeId = nodeId.toLowerCase();
        nodeId = Utilities.normalizeHex(nodeId);
        if (nodeId.length > 42) {
            nodeId = nodeId.substr(-40, 40);
            nodeId = Utilities.normalizeHex(nodeId);
        }
        this.logger.trace(`Adding node ${nodeId} to approved list`);
        if (this.approvedNodes.indexOf(nodeId) === -1) {
            this.approvedNodes.push(nodeId);
        }
    }

    /**
     * Remove a signle node from the approved nodes
     * @param nodeId
     */
    removeApprovedNode(nodeId) {
        nodeId = nodeId.toLowerCase();
        nodeId = Utilities.normalizeHex(nodeId);
        if (nodeId.length > 42) {
            nodeId = nodeId.substr(-40, 40);
            nodeId = Utilities.normalizeHex(nodeId);
        }
        const index = this.approvedNodes.indexOf(nodeId);
        if (index > -1) {
            this.logger.trace(`Removing node ${nodeId} from approved list`);
            this.approvedNodes.splice(index, 1);
        }
    }

    isApproved(nodeId) {
        if (this.approvedNodes.length === 0) {
            return true;
        }
        nodeId = nodeId.toLowerCase();
        nodeId = Utilities.normalizeHex(nodeId);
        if (nodeId.length > 42) {
            nodeId = nodeId.substr(-40, 40);
            nodeId = Utilities.normalizeHex(nodeId);
        }
        return (this.approvedNodes.indexOf(nodeId) !== -1);
    }

    handleApprovalEvent(eventData) {
        const {
            nodeId,
        } = eventData.value;

        if (eventData.name === 'eth-NodeApproved') {
            this.addApprovedNode(nodeId);
        } else if (eventData.name === 'eth-NodeRemoved') {
            this.removeApprovedNode(nodeId);
        } else {
            this.logger.warn('Caught event without specified callback');
        }
    }
}

module.exports = ApprovalService;
