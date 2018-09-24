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

contract ProfileStorage {
    uint256 public activeNodes;
}

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
    mapping(bytes32 => OfferDefinition) offer; // offer[offerId];

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
        bytes32 dataSetID; // Why?
        uint256 stakedAmount;
        bytes32 litigationRootHash;
        uint256 startTime;
    }
    mapping(bytes32 => mapping(address => HolderDefinition)) holder; // holder[offerId][address];

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
    function setHolderStartTime (bytes32 offerId, address identity, uint256 startTime)
    public onlyHolding {
        holder[offerId][identity].startTime = startTime;
    }

    
    
    function getHolderLitigationRootHash (bytes32 offerId, address holderIdentity)
    public view returns(bytes32) {
        return holder[offerId][holderIdentity].litigationRootHash;
    }
}

contract Holding {

    Hub public hub;
    HoldingStorage public holdingStorage;
    ProfileStorage public profileStorage;
    
    constructor(address hubAddress) public{
        hub = Hub(hubAddress);
        holdingStorage = HoldingStorage(hub.holdingStorageAddress());
        profileStorage = ProfileStorage(hub.profileStorageAddres());
    }


    event OfferTask(bytes32 dataSetId, address dcNodeId, bytes32 offerId, bytes32 task);
    event OfferCreated(bytes32 offerId, bytes32 dcNodeId, uint256 holdingTimeInMinutes, uint256 dataSetSizeInBytes, uint256 tokenAmountPerHolder, uint256 litigationIntervalInMinutes);
    event OfferFinalized(bytes32 offerId, address holder1, address holder2, address holder3);
    
    function createOffer(bytes32 dataSetId, 
    bytes32 dataRootHash, bytes32 redLitigationHash, bytes32 greenLitigationHash, bytes32 blueLitigationHash, bytes32 dcNodeId, 
    uint256 holdingTimeInMinutes, uint256 tokenAmountPerHolder, uint256 dataSetSizeInBytes, uint256 litigationIntervalInMinutes) public {
        // First we check that the paramaters are valid
        require(holdingTimeInMinutes > 0, "Holding time cannot be zero");
        require(dataSetSizeInBytes > 0, "Data size cannot be zero");
        require(tokenAmountPerHolder > 0, "Token amount per holder cannot be zero");
        require(litigationIntervalInMinutes > 0, "Litigation time cannot be zero");

        // Now we calculate the offerId, which should be unique
        // We consider a pair of dataSet and identity unique within one block, hence the formula for offerId
        bytes32 offerId = keccak256(abi.encodePacked(dataSetId, msg.sender, blockhash(block.number)));

        //We calculate the task for the data creator to solve
            //Calculating task difficulty
        uint256 difficulty;
        if(logs2(profileStorage.activeNodes()) <= 4) difficulty = 1;
        else {
            difficulty = 4 + (((logs2(profileStorage.activeNodes()) - 4) * 10000) / 13219);
        }
            //Calculating challenge
        bytes32 task = blockhash(block.number) & bytes32(2 ** (difficulty * 4) - 1);
        

        // Writing variables into storage
        holdingStorage.setOfferCreator(offerId, msg.sender);
        holdingStorage.setOfferDataSetId(offerId, dataSetId);
        holdingStorage.setOfferHoldingTimeInMinutes(offerId, holdingTimeInMinutes);
        holdingStorage.setOfferTokenAmountPerHolder(offerId, tokenAmountPerHolder);
        holdingStorage.setOfferTask(offerId, task);
        holdingStorage.setOfferDifficulty(offerId, difficulty);
        holdingStorage.setOfferTimestamp(offerId, block.timestamp);

        holdingStorage.setOfferRedLitigationHash(offerId, redLitigationHash);
        holdingStorage.setOfferGreenLitigationHash(offerId, greenLitigationHash);
        holdingStorage.setOfferBlueLitigationHash(offerId, blueLitigationHash);

        emit OfferTask(dataSetId, msg.sender, offerId, task);
        emit OfferCreated(offerId, dcNodeId, holdingTimeInMinutes, dataSetSizeInBytes, tokenAmountPerHolder, litigationIntervalInMinutes);
    }
  
    function finalizeOffer(bytes32 offerId, uint256 shift, 
        bytes confirmation1, bytes confirmation2, bytes confirmation3,
        uint8[] encryptionType, address[] holderIdentity) 
    public {
        // Verify sender
        require(msg.sender == holdingStorage.getOfferCreator(offerId), "Offer can only be finalized by its creator!");

        // Verify array lengths
        require(encryptionType.length == 3, "Encryption type array length must be 3!");
        require(holderIdentity.length == 3, "Holder identity array length must be 3!");

        //Check if signatures match identities
        address[] memory wallet = new address[](3);
        wallet[0] = ecrecovery(keccak256(abi.encodePacked(offerId,holderIdentity[0])), confirmation1);
        wallet[1] = ecrecovery(keccak256(abi.encodePacked(offerId,holderIdentity[1])), confirmation2);
        wallet[2] = ecrecovery(keccak256(abi.encodePacked(offerId,holderIdentity[2])), confirmation3);
        require(ERC725(holderIdentity[0]).keyHasPurpose(keccak256(abi.encodePacked(wallet[0])), 4), "Wallet from holder 1 does not have encryption approval!");
        require(ERC725(holderIdentity[1]).keyHasPurpose(keccak256(abi.encodePacked(wallet[1])), 4), "Wallet from holder 2 does not have encryption approval!");
        require(ERC725(holderIdentity[2]).keyHasPurpose(keccak256(abi.encodePacked(wallet[2])), 4), "Wallet from holder 3 does not have encryption approval!");

        //Verify task answer
        require((keccak256(abi.encodePacked(holderIdentity[0], holderIdentity[1], holderIdentity[2])) >> shift & bytes32((2 ** (4 * holdingStorage.getOfferDifficulty(offerId))) - 1)) == holdingStorage.getOfferTask(offerId), "Submitted identities do not answer the task correctly!");
        

        //Secure funds from all parties


        //Write data into storage
        for(uint8 i = 0; i < 3; i += 1) {
            holdingStorage.setHolderActive(offerId, holderIdentity[i], true);
            holdingStorage.setHolderStakedAmount(offerId, holderIdentity[i], holdingStorage.getOfferTokenAmountPerHolder(offerId));
            if(encryptionType[i] == 0) holdingStorage.setHolderLitigationRootHash(offerId, holderIdentity[i], holdingStorage.getOfferRedLitigationHash(offerId));
            else if(encryptionType[i] == 1) holdingStorage.setHolderLitigationRootHash(offerId, holderIdentity[i], holdingStorage.getOfferGreenLitigationHash(offerId));
            else if(encryptionType[i] == 2) holdingStorage.setHolderLitigationRootHash(offerId, holderIdentity[i], holdingStorage.getOfferBlueLitigationHash(offerId));
            else require(false, "Encryption type for holder must be set to 0 (red), 1 (green), or 2 (blue)!");
            holdingStorage.setHolderStartTime(offerId, holderIdentity[0], block.timestamp);
        }

        emit OfferFinalized(offerId, holderIdentity[0], holderIdentity[1], holderIdentity[2]);
    }
    
    // event LitigationStarted(bytes32 offerId, address holderProfile, uint256 dataIndex, uint256 litigationTimestamp);
    // event LitigationAnswered(bytes32 offerId, address holderProfile, uint256 dataIndex, bytes32 answerData);
    // event LitigationCompleted(bytes32 offerId, address holderProfile, )
    
    // function startLitigation(bytes32 offerId, address holderProfile, uint256 dataIndex);
    // function answerLitigation(bytes32 offerId, bytes32 answerData);
    // function initiateReplacement(bytes32 offerId, bytes32[] missingData, bytes32 litigatorAnswerData);

    function replaceHolder(bytes32 offerId, address holderIdentity, bytes32 answerData, uint256 dataIndex, 
    bytes signedChallenge, bytes signedAnswer, 
    bytes32 proofData, bytes32[] merkleHashes) public view {
        bytes32 challenge = keccak256(abi.encodePacked(offerId, dataIndex));
        address litigatorWallet = ecrecovery(challenge, signedChallenge);
        require(ERC725(msg.sender).keyHasPurpose(keccak256(abi.encodePacked(litigatorWallet)), 4) || ERC725(msg.sender).keyHasPurpose(keccak256(abi.encodePacked(litigatorWallet)), 1));
    
        address holderWallet = ecrecovery(keccak256(abi.encodePacked(answerData, challenge)), signedAnswer);
        require(ERC725(holderIdentity).keyHasPurpose(keccak256(abi.encodePacked(holderWallet)), 4) || ERC725(holderIdentity).keyHasPurpose(keccak256(abi.encodePacked(holderWallet)), 1));
        
        uint256 i = 0;
        uint256 one = 1;
        proofData = keccak256(abi.encodePacked(proofData, dataIndex));
        answerData = keccak256(abi.encodePacked(proofData, dataIndex));
        
        // ako je bit 1 on je levo
        while (i < merkleHashes.length){

            if( ((one << i) & dataIndex) != 0 ){
                proofData = keccak256(abi.encodePacked(merkleHashes[i], proofData));
                answerData = keccak256(abi.encodePacked(merkleHashes[i], answerData));
            }
            else {
                proofData = keccak256(abi.encodePacked(proofData, merkleHashes[i]));
                answerData = keccak256(abi.encodePacked(answerData, merkleHashes[i]));
            }
            i++;
        }

        if(answerData == holdingStorage.getHolderLitigationRootHash(offerId, holderIdentity)){
            
        }
        else {
            if (proofData == holdingStorage.getHolderLitigationRootHash(offerId, holderIdentity)){
                
            }
            else {
                
            }
        }
    }


    function ecrecovery(bytes32 hash, bytes sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        if (sig.length != 65)
          return address(0);

        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))

            // Here we are loading the last 32 bytes. We exploit the fact that
            // 'mload' will pad with zeroes if we overread.
            // There is no 'mload8' to do this, but that would be nicer.
            v := byte(0, mload(add(sig, 96)))
        }

        // geth uses [0, 1] and some clients have followed. This might change, see:
        //  https://github.com/ethereum/go-ethereum/issues/2053
        if (v < 27) v += 27;

        if (v != 27 && v != 28) return address(0);

        return ecrecover(hash, v, r, s);
    }


    function logs2(uint x) internal pure returns (uint y){
        require(x > 0, "log(0) not allowed");
        assembly {
            let arg := x
            x := sub(x,1)
            x := or(x, div(x, 0x02))
            x := or(x, div(x, 0x04))
            x := or(x, div(x, 0x10))
            x := or(x, div(x, 0x100))
            x := or(x, div(x, 0x10000))
            x := or(x, div(x, 0x100000000))
            x := or(x, div(x, 0x10000000000000000))
            x := or(x, div(x, 0x100000000000000000000000000000000))
            x := add(x, 1)
            let m := mload(0x40)
            mstore(m,           0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd)
            mstore(add(m,0x20), 0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe)
            mstore(add(m,0x40), 0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616)
            mstore(add(m,0x60), 0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff)
            mstore(add(m,0x80), 0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e)
            mstore(add(m,0xa0), 0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707)
            mstore(add(m,0xc0), 0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606)
            mstore(add(m,0xe0), 0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100)
            mstore(0x40, add(m, 0x100))
            let magic := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
            let shift := 0x100000000000000000000000000000000000000000000000000000000000000
            let a := div(mul(x, magic), shift)
            y := div(mload(add(m,sub(255,a))), shift)
            y := add(y, mul(256, gt(arg, 0x8000000000000000000000000000000000000000000000000000000000000000)))
        }
    }
}

