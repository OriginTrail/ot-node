pragma solidity ^0.4.21;

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
     function Ownable () public {
          owner = msg.sender;
     }

     /**
     * @dev Throws if called by any account other than the owner.
     */
     modifier onlyOwner() {
          require(msg.sender == owner);
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

contract ContractHub is Ownable{
     address public fingerprintAddress;
     address public tokenAddress;
     address public biddingAddress;
     address public escrowAddress;
     address public readingAddress;

     event ContractsChanged();

     function ContractHub(address _fingerprintAddress, address _tokenAddress, address _biddingAddress, address _escrowAddress, address _readingAddress)
     public {
          fingerprintAddress = _fingerprintAddress;
          tokenAddress = _tokenAddress;
          biddingAddress = _biddingAddress;
          escrowAddress = _escrowAddress;
          readingAddress = _readingAddress;
     }

     function setFingerprint(address newFingerprintAddress)
     public onlyOwner{
          fingerprintAddress = newFingerprintAddress;
          emit ContractsChanged();
     }

     function setToken(address newTokenAddress)
     public onlyOwner{
          tokenAddress = newTokenAddress;
          emit ContractsChanged();
     }

     function setBidding(address newBiddingAddress)
     public onlyOwner{
          biddingAddress = newBiddingAddress;
          emit ContractsChanged();
     }

     function setEscrow(address newEscrowAddress)
     public onlyOwner{
          escrowAddress = newEscrowAddress;
          emit ContractsChanged();
     }

     function setReading(address newReadingAddress)
     public onlyOwner{
          readingAddress = newReadingAddress;
          emit ContractsChanged();
     }   
     
}