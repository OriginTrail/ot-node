pragma solidity ^0.4.24;

/**
* @title Ownable
* @dev The Ownable contract has an owner address, and provides basic authorization control
* functions, this simplifies the implementation of "user permissions".
*/
contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
    * @dev The Ownable constructor sets the original `owner` of the contract to the sender
    * account.
    */
    constructor () public {
        owner = msg.sender;
    }

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can call this function");
        _;
    }

    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

}

contract Approval is Ownable{
    bytes20[] public allNodes;
    mapping (bytes20 => bool) public nodeApproved;
	mapping (address => bool) public identityApproved;

    event NodeApproved(bytes20 nodeId);
    event NodeRemoved(bytes20 nodeId);

	function identityHasApproval(address identity)
    public view returns(bool) {
        return identityApproved[identity];
    }

    function nodeHasApproval(bytes20 nodeId)
    public view returns(bool) {
        return nodeApproved[nodeId];
    }

    function getAllNodes() public view returns(bytes20[]){
        return allNodes;
    }
    
    function approve(address identity, bytes20 nodeId) 
    public onlyOwner {
        if(identity != address(0)) identityApproved[identity] = true;
        if(nodeId != bytes20(0)) {
            allNodes.push(nodeId);
            nodeApproved[nodeId] = true;
            emit NodeApproved(nodeId);
        }
    }

    function removeApproval(address identity, bytes20 nodeId) 
    public onlyOwner {
        if(identity != address(0) && identityApproved[identity]){
            identityApproved[identity] = false;
        }
        if(nodeId != bytes20(0) && nodeApproved[nodeId]){
            nodeApproved[nodeId] = false;
            emit NodeRemoved(nodeId);
        }
    }

	function setIdentityApproval(address identity, bool newApproval) 
	public onlyOwner {
		if(identity != address(0) && newApproval != identityApproved[identity])
			identityApproved[identity] = newApproval;
	}
}