pragma solidity ^0.4.18;
contract Ownable {
  address public owner;
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function constructor () public { owner = msg.sender; }
  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() { require(msg.sender == owner); _; }
  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) onlyOwner public {
    require(newOwner != address(0));
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }
}
contract OTFingerprintStore is Ownable{
    /* utilities */
    uint256 private weekInSeconds = 86400 * 7;
    uint256 public _version;
    /* Data Holder Fingerprint Store */ 
    // mapping(address => mapping (bytes32 => bytes32)) public DHFS; 
    mapping(address => mapping (bytes32 => FingerprintDefinition)) public DHFS;

    struct FingerprintDefinition{
      bytes32 graph_hash;
      bytes32 import_hash;
    }

    /* Agreement store */
    struct Agreement {
        uint256 startTime;
        uint256 endTime;
        bytes32 data_hash;
    }
    
    mapping (address => mapping (address => Agreement[])) public agreements;
    mapping (address => address[]) public agreementPartiesList;
    event Fingerprint(address indexed dataHolder, string indexed batch_id, bytes32 indexed batch_id_hash, bytes32 graph_hash);
    event Agreed(address indexed dataCreator, address indexed dataHolder, bytes32 indexed batch_id_hash, bytes32 graph_hash, uint256 startTime, uint256 endTime);
    
    
    function OTHashStore(uint256 version) public {
        _version = version;
    }
    function getVersion() public constant returns (uint256){
        return _version;
    }
    /* Fingerprinting */
    /* Store a fingerpring of a graph identified by batch_id and hash of batch_id */
    function addFingerPrint(string batch_id, bytes32 batch_id_hash, bytes32 graph_hash, bytes32 import_hash) public returns (bool){
        require(msg.sender!=address(0));
        require(batch_id_hash!=0x0);
        require(graph_hash!=0x0);
        require(DHFS[msg.sender][batch_id_hash].graph_hash== bytes32(0));
        DHFS[msg.sender][batch_id_hash].graph_hash = graph_hash;
        DHFS[msg.sender][batch_id_hash].import_hash = import_hash;

        emit Fingerprint(msg.sender,batch_id,batch_id_hash,graph_hash);      
    }
    function getFingerprintByBatchHash(address dataHolder, bytes32 batch_id_hash) public constant returns (bytes32 graph_hash, bytes32 import_hash){
        require(dataHolder!=address(0));
        require(batch_id_hash!=0x0);
        return (DHFS[dataHolder][batch_id_hash].graph_hash, DHFS[dataHolder][batch_id_hash].import_hash);
    }
    /* Agreements */ 
    function createAgreement(address dataHolder, uint256 startTime, uint256 endTime,bytes32 batch_id_hash, bytes32 data_hash) public returns (bool){
        require(msg.sender!=address(0));
        require(dataHolder!=address(0));
        require(startTime>= now);
        require(endTime > startTime);
        Agreement memory newAgreement = Agreement({
            startTime: startTime,
            endTime: endTime,
            data_hash: data_hash
            });
        agreementPartiesList[msg.sender].push(dataHolder);
        agreements[msg.sender][dataHolder].push(newAgreement);
        emit Agreed(msg.sender, dataHolder,batch_id_hash, data_hash, startTime,endTime);
    }
    
    function getAgreementPartiesCount() public constant returns(uint partiesCount) {
        return agreementPartiesList[msg.sender].length;
    }
    function getNumberOfAgreements(address party) public constant returns (uint agreementCount){
        require(msg.sender!=address(0));
        require(party!=address(0));
        return agreements[msg.sender][party].length;
    }
}