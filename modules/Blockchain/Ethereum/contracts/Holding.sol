pragma solidity ^0.4.24;

contract ERC725 {

    uint256 constant MANAGEMENT_KEY = 1;
    uint256 constant ACTION_KEY = 2;
    uint256 constant CLAIM_SIGNER_KEY = 3;
    uint256 constant ENCRYPTION_KEY = 4;

    event KeyAdded(bytes32 indexed key, uint256 indexed purpose, uint256 indexed keyType);
    event KeyRemoved(bytes32 indexed key, uint256 indexed purpose, uint256 indexed keyType);
    event ExecutionRequested(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
    event Executed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
    event Approved(uint256 indexed executionId, bool approved);

    struct Key {
        uint256 purpose; //e.g., MANAGEMENT_KEY = 1, ACTION_KEY = 2, etc.
        uint256 keyType; // e.g. 1 = ECDSA, 2 = RSA, etc.
        bytes32 key;
    }

    function getKey(bytes32 _key) public constant returns(uint256[] purposes, uint256 keyType, bytes32 key);
    function keyHasPurpose(bytes32 _key, uint256 _purpose) public constant returns (bool exists);
    function getKeysByPurpose(uint256 _purpose) public constant returns (bytes32[] keys);
    function addKey(bytes32 _key, uint256 _purpose, uint256 _keyType) public returns (bool success);
    function removeKey(bytes32 _key, uint256 _purpose) public returns (bool success);
    function execute(address _to, uint256 _value, bytes _data) public returns (uint256 executionId);
    function approve(uint256 _id, bool _approve) public returns (bool success);
}

contract Hub {
    address public profileAddress;
    address public profileStorageAddres;
    address public holdingAddress;
    address public holdingStorageAddress;
}

contract Holding {
    Hub public hub;
    HoldingStorage public holdingStorage;
    
    constructor(address hubAddress) public{
        hub = Hub(hubAddress);
        holdingStorage = HoldingStorage(hub.holdingStorageAddress());
    }
    
    
    function createOffer(bytes32 dataSetId, bytes32 dcNodeId, uint256 holdingTimeInMinutes,
    uint256 dataSetSizeInBytes, uint256 tokenAmountPerHolder, uint256 litigationIntervalInMinutes) public{
        byte b = byte(keccak256(abi.encodePacked(dataSetId)));
    }
    
    event OfferTask(bytes32 dataSetId, address dcProfile, bytes32 offerId, string task);
    event OfferCreated(bytes32 offerID, bytes32 dcNodeId, uint256 holdingTimeInMinutes, uint256 dataSetSizeInBytes, uint256 tokenAmountPerHolder, uint256 litigationIntervalInMinutes);
    
    function finalizeOffer(bytes32 offerId, uint256 shift, bytes32 confirmation1, uint8 v1, bytes32 r1, bytes32 s1, bytes32 confirmation2, uint8 v2, bytes32 r2, bytes32 s2, bytes32 confirmation3, uint8 v3, bytes32 r3, bytes32 s3 ) public; // ....
    event OfferFinalized(bytes32 offerId, address holder1, address holder2, address holder3);
    
    // event LitigationStarted(bytes32 offerID, address holderProfile, uint256 dataIndex, uint256 litigationTimestamp);
    // event LitigationAnswered(bytes32 offerID, address holderProfile, uint256 dataIndex, bytes32 answerData);
    // event LitigationCompleted(bytes32 offerID, address holderProfile, )
    
    // function startLitigation(bytes32 offerID, address holderProfile, uint256 dataIndex);
    // function answerLitigation(bytes32 offerID, bytes32 answerData);
    // function initiateReplacement(bytes32 offerID, bytes32[] missingData, bytes32 litigatorAnswerData);

    function replaceHolder(bytes32 offerId, address holderIdentity, bytes32 answerData, uint256 dataIndex, uint8 challengeV, bytes32 challengeR, bytes32 challengeS,
    uint8 answerV, bytes32 answerR, bytes32 answerS, bytes32 correctAnswer, bytes32[] merkleHashes) public{
        bytes32 challenge = keccak256(abi.encodePacked(offerId, dataIndex));
        address litigatorWallet = ecrecover(challenge, challengeV, challengeR, challengeS);
        require(ERC725(msg.sender).keyHasPurpose(keccak256(abi.encodePacked(litigatorWallet)), 4) || ERC725(msg.sender).keyHasPurpose(keccak256(abi.encodePacked(litigatorWallet)), 1));
    
        address holderWallet = ecrecover(keccak256(abi.encodePacked(answerData, challenge)), answerV, answerR, answerS);
        require(ERC725(holderIdentity).keyHasPurpose(keccak256(abi.encodePacked(holderWallet)), 4) || ERC725(holderIdentity).keyHasPurpose(keccak256(abi.encodePacked(holderWallet)), 1));
        
        uint256 i = 0;
        uint256 one = 1;
        correctAnswer = keccak256(abi.encodePacked(correctAnswer, dataIndex));
        answerData = keccak256(abi.encodePacked(correctAnswer, dataIndex));
        
        // ako je bit 1 on je levo
        while (i < merkleHashes.length){

            if( ((one << i) & dataIndex) != 0 ){
                correctAnswer = keccak256(abi.encodePacked(merkleHashes[i], correctAnswer));
                answerData = keccak256(abi.encodePacked(merkleHashes[i], answerData));
            }
            else {
                correctAnswer = keccak256(abi.encodePacked(correctAnswer, merkleHashes[i]));
                answerData = keccak256(abi.encodePacked(answerData, merkleHashes[i]));
            }
            i++;
        }

        if(answerData == holdingStorage.getHolderLitigationRootHash(offerId, holderIdentity)){
            
        }
        else {
            if (correctAnswer == holdingStorage.getHolderLitigationRootHash(offerId, holderIdentity)){
                
            }
            else {
                
            }
        }
    }
}

contract HoldingStorage {
    struct Offer {
        bytes32 dataSetID;
        uint256 holdingTime;
        uint256 amountPerDH;
        string challenge;
    }
    mapping(bytes32 => Offer) offer; // offer[offerID];
    
    struct Holder {
        bool active;
        bytes32 dataSetID;
        uint256 stakedAmount;
        bytes32 litigationRootHash;
    }
    mapping(bytes32 => mapping(address => Holder)) holder; // holder[offerId][address];
    
    function getHolderLitigationRootHash (bytes32 offerId, address holderIdentity)
    public view returns(bytes32) {
        return holder[offerId][holderIdentity].litigationRootHash;
    }
    

}
