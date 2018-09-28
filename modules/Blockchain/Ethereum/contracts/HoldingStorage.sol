pragma solidity ^0.4.24;

contract Hub {
    address public profileAddress;
    address public profileStorageAddres;
    address public holdingAddress;
    address public holdingStorageAddress;
}

contract HoldingStorage {
    Hub public hub;
    
    constructor(address hubAddress) public{
        hub = Hub(hubAddress);
    }

    modifier onlyHolding() {
        require(msg.sender == hub.holdingAddress(),
        "Function can only be called by Holding contract!");
        _;
    }

    mapping(bytes32 => bytes32) public fingerprint;

    function setFingerprint(bytes32 dataSetId, bytes32 dataRootHash)
    public onlyHolding {
        fingerprint[dataSetId] = dataRootHash;
    }

    struct OfferDefinition {
        address creator;
        bytes32 dataSetId;
        uint256 holdingTimeInMinutes;
        uint256 tokenAmountPerHolder;
        bytes32 task;
        uint256 difficulty;
        uint256 timestamp;

        bytes32 redLitigationHash;
        bytes32 greenLitigationHash;
        bytes32 blueLitigationHash;
    }
    mapping(bytes32 => OfferDefinition) public offer; // offer[offerId];

    function getOfferCreator (bytes32 offerId) 
    public view returns(address creator){
        return offer[offerId].creator;
    }
    function getOfferDataSetId (bytes32 offerId) 
    public view returns(bytes32 dataSetId){
        return offer[offerId].dataSetId;
    }
    function getOfferHoldingTimeInMinutes (bytes32 offerId) 
    public view returns(uint256 holdingTimeInMinutes){
        return offer[offerId].holdingTimeInMinutes;
    }
    function getOfferTokenAmountPerHolder (bytes32 offerId) 
    public view returns(uint256 tokenAmountPerHolder){
        return offer[offerId].tokenAmountPerHolder;
    }
    function getOfferTask (bytes32 offerId) 
    public view returns(bytes32 task){
        return offer[offerId].task;
    }
    function getOfferDifficulty (bytes32 offerId) 
    public view returns(uint256 difficulty){
        return offer[offerId].difficulty;
    }
    function getOfferTimestamp (bytes32 offerId) 
    public view returns(uint256 timestamp){
        return offer[offerId].timestamp;
    }
    function getOfferRedLitigationHash (bytes32 offerId) 
    public view returns(bytes32 redLitigationHash){
        return offer[offerId].redLitigationHash;
    }
    function getOfferGreenLitigationHash (bytes32 offerId) 
    public view returns(bytes32 greenLitigationHash){
        return offer[offerId].greenLitigationHash;
    }
    function getOfferBlueLitigationHash (bytes32 offerId) 
    public view returns(bytes32 blueLitigationHash){
        return offer[offerId].blueLitigationHash;
    }

    function setOfferCreator (bytes32 offerId, address creator)
    public onlyHolding {
        offer[offerId].creator = creator;
    }
    function setOfferDataSetId (bytes32 offerId, bytes32 dataSetId)
    public onlyHolding {
        offer[offerId].dataSetId = dataSetId;
    }
    function setOfferHoldingTimeInMinutes (bytes32 offerId, uint256 holdingTimeInMinutes)
    public onlyHolding {
        offer[offerId].holdingTimeInMinutes = holdingTimeInMinutes;
    }
    function setOfferTokenAmountPerHolder (bytes32 offerId, uint256 tokenAmountPerHolder)
    public onlyHolding {
        offer[offerId].tokenAmountPerHolder = tokenAmountPerHolder;
    }
    function setOfferTask (bytes32 offerId, bytes32 task)
    public onlyHolding {
        offer[offerId].task = task;
    }
    function setOfferDifficulty (bytes32 offerId, uint256 difficulty)
    public onlyHolding {
        offer[offerId].difficulty = difficulty;
    }
    function setOfferTimestamp (bytes32 offerId, uint256 timestamp)
    public onlyHolding {
        offer[offerId].timestamp = timestamp;
    }
    function setOfferRedLitigationHash (bytes32 offerId, bytes32 redLitigationHash)
    public onlyHolding {
        offer[offerId].redLitigationHash = redLitigationHash;
    }
    function setOfferGreenLitigationHash (bytes32 offerId, bytes32 greenLitigationHash)
    public onlyHolding {
        offer[offerId].greenLitigationHash = greenLitigationHash;
    }
    function setOfferBlueLitigationHash (bytes32 offerId, bytes32 blueLitigationHash)
    public onlyHolding {
        offer[offerId].blueLitigationHash = blueLitigationHash;
    }

    struct HolderDefinition {
        bool active;
        uint256 stakedAmount;
        bytes32 litigationRootHash;
        uint256 litigationEncryptionType;
        uint256 startTime;
    }
    mapping(bytes32 => mapping(address => HolderDefinition)) public holder; // holder[offerId][address];

    function setHolderActive (bytes32 offerId, address identity, bool active)
    public onlyHolding {
        holder[offerId][identity].active = active;
    }
    function setHolderStakedAmount (bytes32 offerId, address identity, uint256 stakedAmount)
    public onlyHolding {
        holder[offerId][identity].stakedAmount = stakedAmount;
    }
    function setHolderLitigationRootHash (bytes32 offerId, address identity, bytes32 litigationRootHash)
    public onlyHolding {
        holder[offerId][identity].litigationRootHash = litigationRootHash;
    }
    function setHolderLitigationEncryptionType(bytes32 offerId, address identity, uint256 litigationEncryptionType)
    public onlyHolding {
        holder[offerId][identity].litigationEncryptionType = litigationEncryptionType;
    }
    function setHolderStartTime (bytes32 offerId, address identity, uint256 startTime)
    public onlyHolding {
        holder[offerId][identity].startTime = startTime;
    }

    
    
    function getHolderLitigationRootHash (bytes32 offerId, address holderIdentity)
    public view returns(bytes32) {
        return holder[offerId][holderIdentity].litigationRootHash;
    }
}
