pragma solidity ^0.4.25;

import {SafeMath} from "./SafeMath.sol";
import {Hub} from "./Hub.sol";
import {Holding} from "./Holding.sol";
import {HoldingStorage} from "./HoldingStorage.sol";
import {ProfileStorage} from "./ProfileStorage.sol";
import {LitigationStorage} from "./LitigationStorage.sol";

contract MockLitigation {
	using SafeMath for uint256;

	Hub public hub;

	Holding public holding;

	LitigationStorage public litigationStorage;
	HoldingStorage public holdingStorage;
	ProfileStorage public profileStorage;

	constructor (address hubAddress) public {
		hub = Hub(hubAddress);

		holding = Holding(hub.getContractAddress("Holding"));

		litigationStorage = LitigationStorage(hub.getContractAddress("LitigationStorage"));
		holdingStorage = HoldingStorage(hub.getContractAddress("HoldingStorage"));
		profileStorage = ProfileStorage(hub.getContractAddress("ProfileStorage"));
	}

	function setHubAddress(address newHubAddress) public {
		require(hub.isContract(msg.sender), "This function can only be called by contracts or their creator!");

		hub = Hub(newHubAddress);

		holding = Holding(hub.getContractAddress("Holding"));

		litigationStorage = LitigationStorage(hub.getContractAddress("LitigationStorage"));
		holdingStorage = HoldingStorage(hub.getContractAddress("HoldingStorage"));
		profileStorage = ProfileStorage(hub.getContractAddress("ProfileStorage"));
	}

	/*    ----------------------------- LITIGATION -----------------------------     */

	event LitigationInitiated(bytes32 offerId, address holderIdentity, uint requestedDataIndex);
	event LitigationAnswered(bytes32 offerId, address holderIdentity);
	event LitigationTimedOut(bytes32 offerId, address holderIdentity);
	event LitigationCompleted(bytes32 offerId, address holderIdentity, bool DH_was_penalized);


	function initiateLitigation(bytes32 offerId, address holderIdentity, address litigatorIdentity, uint requestedDataIndex, bytes32[] hashArray)
	public returns (bool newLitigationInitiated){
		litigationStorage.setLitigationLitigatorIdentity(offerId, holderIdentity, litigatorIdentity);
		litigationStorage.setLitigationRequestedDataIndex(offerId, holderIdentity, requestedDataIndex);
		litigationStorage.setLitigationHashArray(offerId, holderIdentity, hashArray);
		
		litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.initiated);
		litigationStorage.setLitigationTimestamp(offerId, holderIdentity, block.timestamp);

		emit LitigationInitiated(offerId, holderIdentity, requestedDataIndex);
		return true;
	}

	function answerLitigation(bytes32 offerId, address holderIdentity, bytes32 requestedData)
	public returns (bool answer_accepted){
		litigationStorage.setLitigationRequestedData(offerId, holderIdentity,
			keccak256(abi.encodePacked(requestedData, litigationStorage.getLitigationRequestedDataIndex(offerId, holderIdentity))));
		
		litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.answered);
		litigationStorage.setLitigationTimestamp(offerId, holderIdentity, block.timestamp);

		emit LitigationAnswered(offerId, holderIdentity);
		return true;
	}

	event ReplacementStarted(bytes32 offerId, address challengerIdentity, bytes32 litigationRootHash);
	event ReplacementCompleted(bytes32 offerId, address challengerIdentity, address chosenHolder);

	function completeLitigation(bytes32 offerId, address holderIdentity, address challengerIdentity, bytes32 proof_data)
	public returns (bool DH_was_penalized){

		uint256[] memory parameters = new uint256[](5);
		parameters[0] = 0;
		parameters[1] = 1;
		bytes32[] memory bytesParameters = new bytes32[](3);


		if(holdingStorage.getHolderLitigationEncryptionType(offerId, holderIdentity) == 0){
			bytesParameters[2] = litigationStorage.getLitigationRequestedData(offerId, holderIdentity);
		} else if (holdingStorage.getHolderLitigationEncryptionType(offerId, holderIdentity) == 1) {
			bytesParameters[2] = holdingStorage.getOfferGreenLitigationHash(offerId);
		} else {
			bytesParameters[2] = holdingStorage.getOfferBlueLitigationHash(offerId);
		}

		// Set new offer parameters
			// Calculate and set difficulty
		
		if(holdingStorage.difficultyOverride() != 0) parameters[2] = holdingStorage.difficultyOverride();
		else {
		    if(logs2(profileStorage.activeNodes()) <= 4) parameters[2] = 1;
		    else {
		        parameters[2] = 4 + (((logs2(profileStorage.activeNodes()) - 4) * 10000) / 13219);
		    }
		}
		litigationStorage.setLitigationReplacementDifficulty(offerId, holderIdentity, parameters[2]);
			// Calculate and set task
		litigationStorage.setLitigationReplacementTask(offerId, holderIdentity, blockhash(block.number - 1) & bytes32(2 ** (parameters[2] * 4) - 1));

		// Pay the previous holder
		parameters[3] = holdingStorage.getHolderStakedAmount(offerId, holderIdentity);
		parameters[3] = parameters[3].mul(block.timestamp.sub(holdingStorage.getHolderPaymentTimestamp(offerId, holderIdentity)));
		parameters[3] = parameters[3].div(holdingStorage.getOfferHoldingTimeInMinutes(offerId).mul(60));

		require(holdingStorage.getHolderPaidAmount(offerId, holderIdentity).add(parameters[3]) < holdingStorage.getHolderStakedAmount(offerId, holderIdentity),
			"Holder considered to successfully completed offer, cannot complete litigation!");

		profileStorage.setStake(holderIdentity, profileStorage.getStake(holderIdentity).add(parameters[3]));
		parameters[4] = profileStorage.getStake(holdingStorage.getOfferCreator(offerId));
		profileStorage.setStake(holdingStorage.getOfferCreator(offerId), parameters[4].sub(parameters[3]));
		parameters[4] = profileStorage.getStakeReserved(holdingStorage.getOfferCreator(offerId));
		profileStorage.setStakeReserved(holdingStorage.getOfferCreator(offerId), parameters[4].sub(parameters[3]));	
		holdingStorage.setHolderPaidAmount(offerId, holderIdentity, holdingStorage.getHolderPaidAmount(offerId, holderIdentity).add(parameters[3]));

		litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.replacing);
		litigationStorage.setLitigationTimestamp(offerId, holderIdentity, block.timestamp);

		emit LitigationCompleted(offerId, holderIdentity, true);
		emit ReplacementStarted(offerId, challengerIdentity, bytesParameters[2]);
		return true;
	}

	function replaceHolder(bytes32 offerId, address holderIdentity, address litigatorIdentity, uint256 shift,
        bytes confirmation1, bytes confirmation2, bytes confirmation3, address[] replacementHolderIdentity)
	public {
		replacementHolderIdentity[0] = replacementHolderIdentity[block.timestamp % 3];
		uint256 litigationEncryptionType = holdingStorage.getHolderLitigationEncryptionType(offerId, holderIdentity);
		uint256 stakedAmount = holdingStorage.getHolderStakedAmount(offerId, holderIdentity).sub(holdingStorage.getHolderPaidAmount(offerId, holderIdentity));

		// Pay the litigator
		profileStorage.setStake(litigatorIdentity, profileStorage.getStake(litigatorIdentity).add(holdingStorage.getHolderPaidAmount(offerId, holderIdentity)));
		profileStorage.setStake(holderIdentity, profileStorage.getStake(holderIdentity).sub(holdingStorage.getHolderPaidAmount(offerId, holderIdentity)));
		profileStorage.setStakeReserved(holderIdentity, profileStorage.getStakeReserved(holderIdentity).sub(holdingStorage.getHolderPaidAmount(offerId, holderIdentity)));

		profileStorage.setStakeReserved(replacementHolderIdentity[0], profileStorage.getStakeReserved(replacementHolderIdentity[0]).add(stakedAmount));
		holdingStorage.setHolderStakedAmount(offerId, replacementHolderIdentity[0], stakedAmount);
		holdingStorage.setHolderLitigationEncryptionType(offerId, replacementHolderIdentity[0], litigationEncryptionType);
		holdingStorage.setHolderPaymentTimestamp(offerId, replacementHolderIdentity[0], block.timestamp);

		profileStorage.setStakeReserved(litigatorIdentity, profileStorage.getStakeReserved(litigatorIdentity).add(stakedAmount));
		holdingStorage.setHolderStakedAmount(offerId, litigatorIdentity, stakedAmount);
		holdingStorage.setHolderLitigationEncryptionType(offerId, litigatorIdentity, litigationEncryptionType);
		holdingStorage.setHolderPaymentTimestamp(offerId, litigatorIdentity, block.timestamp);

		litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.replaced);
		emit ReplacementCompleted(offerId, litigatorIdentity, replacementHolderIdentity[0]);
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
}