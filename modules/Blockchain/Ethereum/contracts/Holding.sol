pragma solidity ^0.4.24;

import './Hub.sol';
import {ERC725} from './ERC725.sol';
import {HoldingStorage} from './HoldingStorage.sol';
import {ProfileStorage} from './ProfileStorage.sol';
import {Profile} from './Profile.sol';
import {SafeMath} from './SafeMath.sol';

contract Holding is Ownable {
    using SafeMath for uint256;

    Hub public hub;
    HoldingStorage public holdingStorage;
    ProfileStorage public profileStorage;
    Profile public profile;

    uint256 public difficultyOverride;
    
    constructor(address hubAddress) public{
        hub = Hub(hubAddress);
        holdingStorage = HoldingStorage(hub.holdingStorageAddress());
        profileStorage = ProfileStorage(hub.profileStorageAddress());
        profile = Profile(hub.profileAddress());
        difficultyOverride = 0;
    }


    event OfferTask(bytes32 dataSetId, bytes32 dcNodeId, bytes32 offerId, bytes32 task);
    event OfferCreated(bytes32 offerId, bytes32 dcNodeId, uint256 holdingTimeInMinutes, uint256 dataSetSizeInBytes, uint256 tokenAmountPerHolder, uint256 litigationIntervalInMinutes);
    event OfferFinalized(bytes32 offerId, address holder1, address holder2, address holder3);

    function createOffer(address identity, bytes32 dataSetId,
    bytes32 dataRootHash, bytes32 redLitigationHash, bytes32 greenLitigationHash, bytes32 blueLitigationHash, bytes32 dcNodeId, 
    uint256 holdingTimeInMinutes, uint256 tokenAmountPerHolder, uint256 dataSetSizeInBytes, uint256 litigationIntervalInMinutes) public {
        // Verify sender
        require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2));

        // First we check that the paramaters are valid
        require(dataRootHash != bytes32(0), "Data root hash cannot be zero");
        require(redLitigationHash != bytes32(0), "Litigation hash cannot be zero");
        require(greenLitigationHash != bytes32(0), "Litigation root hash cannot be zero");
        require(blueLitigationHash != bytes32(0), "Litigation root hash cannot be zero");
        require(holdingTimeInMinutes > 0, "Holding time cannot be zero");
        require(dataSetSizeInBytes > 0, "Data size cannot be zero");
        require(tokenAmountPerHolder > 0, "Token amount per holder cannot be zero");
        require(litigationIntervalInMinutes > 0, "Litigation time cannot be zero");

        // Writing data root hash if it wasn't previously set
        if(holdingStorage.fingerprint(dataSetId) == bytes32(0)){
            holdingStorage.setFingerprint(dataSetId, dataRootHash);
        }

        // Now we calculate the offerId, which should be unique
        // We consider a pair of dataSet and identity unique within one block, hence the formula for offerId
        bytes32 offerId = keccak256(abi.encodePacked(dataSetId, identity, blockhash(block.number - 1)));


        //We calculate the task for the data creator to solve
            //Calculating task difficulty
        uint256 difficulty;
        if(difficultyOverride != 0) difficulty = difficultyOverride;
        else {
            if(logs2(profileStorage.activeNodes()) <= 4) difficulty = 1;
            else {
                difficulty = 4 + (((logs2(profileStorage.activeNodes()) - 4) * 10000) / 13219);
            }
        }
        
        // Writing variables into storage
        holdingStorage.setOfferParameters(
            offerId,
            identity,
            dataSetId,
            holdingTimeInMinutes,
            tokenAmountPerHolder,
            blockhash(block.number - 1) & bytes32(2 ** (difficulty * 4) - 1),
            difficulty
        );

        holdingStorage.setOfferLitigationHashes(
            offerId,
            redLitigationHash,
            greenLitigationHash,
            blueLitigationHash
        );

        emit OfferTask(dataSetId, dcNodeId, offerId, blockhash(block.number - 1) & bytes32(2 ** (difficulty * 4) - 1));
        emit OfferCreated(offerId, dcNodeId, holdingTimeInMinutes, dataSetSizeInBytes, tokenAmountPerHolder, litigationIntervalInMinutes);
    }

    function finalizeOffer(address identity, bytes32 offerId, uint256 shift,
        bytes confirmation1, bytes confirmation2, bytes confirmation3,
        uint8[] encryptionType, address[] holderIdentity) 
    public {
        // Verify sender
        require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2));
        require(identity == holdingStorage.getOfferCreator(offerId), "Offer can only be finalized by its creator!");

        // Check if signatures match identities
        require(ERC725(holderIdentity[0]).keyHasPurpose(keccak256(abi.encodePacked(ecrecovery(keccak256(abi.encodePacked(uint256(offerId),uint256(holderIdentity[0]))), confirmation1))), 4), "Wallet from holder 1 does not have encryption approval!");
        require(ERC725(holderIdentity[1]).keyHasPurpose(keccak256(abi.encodePacked(ecrecovery(keccak256(abi.encodePacked(uint256(offerId),uint256(holderIdentity[1]))), confirmation2))), 4), "Wallet from holder 2 does not have encryption approval!");
        require(ERC725(holderIdentity[2]).keyHasPurpose(keccak256(abi.encodePacked(ecrecovery(keccak256(abi.encodePacked(uint256(offerId),uint256(holderIdentity[2]))), confirmation3))), 4), "Wallet from holder 3 does not have encryption approval!");

        // Verify task answer
        require(((keccak256(abi.encodePacked(holderIdentity[0], holderIdentity[1], holderIdentity[2])) >> (shift * 4)) & bytes32((2 ** (4 * holdingStorage.getOfferDifficulty(offerId))) - 1)) == holdingStorage.getOfferTask(offerId), "Submitted identities do not answer the task correctly!");

        // Secure funds from all parties
        profile.reserveTokens(
            identity,
            holderIdentity[0],
            holderIdentity[1],
            holderIdentity[2],
            holdingStorage.getOfferTokenAmountPerHolder(offerId)
        );

        // Write data into storage
        holdingStorage.setHolders(offerId, holderIdentity, encryptionType);

        emit OfferFinalized(offerId, holderIdentity[0], holderIdentity[1], holderIdentity[2]);
    }

    function payOut(address identity, bytes32 offerId)
    public {
        // Verify sender
        require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2));

        // Verify holder
        uint256 amountToTransfer = holdingStorage.getHolderStakedAmount(offerId, identity);
        require(amountToTransfer > 0, "Sender is not holding this data set!");

        // Verify that holding time expired
        require(holdingStorage.getOfferStartTime(offerId) +
            holdingStorage.getOfferHoldingTimeInMinutes(offerId).mul(60) < block.timestamp,
            "Holding time not yet expired!");

        // Release tokens staked by holder and transfer tokens from data creator to holder
        Profile(hub.profileAddress()).releaseTokens(identity, amountToTransfer);
        Profile(hub.profileAddress()).transferTokens(holdingStorage.getOfferCreator(offerId), identity, amountToTransfer);
    }
    
    function ecrecovery(bytes32 hash, bytes sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        if (sig.length != 65)
          return address(0);

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));
  
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

        return ecrecover(prefixedHash, v, r, s);
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

    function setDifficulty(uint256 new_difficulty) 
    public onlyOwner{
        difficultyOverride = new_difficulty;
    }
}

