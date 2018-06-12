pragma solidity ^0.4.19;

contract TestingUtilities{
	bool internalData;

	function keccak2hashes(bytes32 a, bytes32 b)
	public pure returns (bytes32){
		return keccak256(a,b);
	}

	function keccakString(string a)
	public pure returns (bytes32){
		return keccak256(a);
	}

	function keccakIndex(bytes32 a, uint b)
	public pure returns (bytes32){
		return keccak256(a,b);
	}

	function keccakSender()
	public view returns (bytes32){
		return keccak256(msg.sender);
	}

	function keccakAddressBytes(address adr, bytes32 byt)
	public pure returns (bytes32){
		return keccak256(adr, byt);
	}

	function keccakOffer(address adr, bytes32 nod_id, uint data_id)
	public pure returns (bytes32){
		return keccak256(adr, nod_id, data_id);
	}

	function getBlockTimestamp()
	public view returns (uint){
		return block.timestamp;
	}

	function getBlockNumber()
	public view returns (uint){
		return block.number;
	}

	function moveTheBlock()
	public{
		internalData = !internalData;
	}

	function escrowHash(bytes32 offer_hash, address DH_wallet, bytes32 DH_node_id)
	public pure returns (bytes32){
		return keccak256(offer_hash, DH_wallet, DH_node_id);
	} 

	event PreIPosle(uint a);

	function error()
	public{
		emit PreIPosle(1);
		require(false);
		emit PreIPosle(2);
	}
}