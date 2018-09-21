pragma solidity ^0.4.24;

contract Hub {
    address public holdingAddress;
    address public holdingStorageAddress;
}

contract Holding {
    event OfferTask(bytes32 dataSetId, address dcProfile, bytes32 offerId, byte task);
    event OfferCreated(bytes32 offerId, bytes32 dcNodeId);

    function createOffer(bytes32 dataSetId, bytes32 dcNodeId) public{
        emit OfferCreated(keccak256(abi.encodePacked(dataSetId)), dcNodeId);
        emit OfferTask(dataSetId, msg.sender, keccak256(abi.encodePacked(dataSetId)), byte(keccak256(abi.encodePacked(blockhash(block.number)))));
    }

    function finalizeOffer(bytes32 offerId, uint256 shift, bytes32 confirmation1, uint8 v1, bytes32 r1, bytes32 s1, bytes32 confirmation2, uint8 v2, bytes32 r2, bytes32 s2, bytes32 confirmation3, uint8 v3, bytes32 r3, bytes32 s3 ) public; // ....
    
    event OfferFinalized(bytes32 offerId, address holder1, address holder2, address holder3);
    function finalizeOffer(bytes32 offerId, address holder1, address holder2, address holder3) public{
        emit OfferFinalized(offerId, holder1, holder2, holder3);
    }
}



