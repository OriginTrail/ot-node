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

contract MockApproval is Ownable{
	mapping (address => bool) public identityApproved;
	mapping (bytes32 => bool) public nodeIdApproved;

	function identityHasApproval(address identity)
    public view returns(bool) {
        return true;
    }

    function nodeHasApproval(bytes32 nodeId)
    public view returns(bool) {
        return true;
    }

	function setApproval(address identity, bytes32 nodeId, bool newApproval) 
	public onlyOwner {
		if(identity != address(0) && newApproval != identityApproved[identity])
			identityApproved[identity] = newApproval;

		if(nodeId != bytes32(0) && newApproval != nodeIdApproved[nodeId])
			nodeIdApproved[nodeId] = newApproval;
	}
}