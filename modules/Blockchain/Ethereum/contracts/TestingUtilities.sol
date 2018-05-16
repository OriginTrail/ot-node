pragma solidity ^0.4.19;

contract TestingUtilities{
	bool internalData;

	function keccak2(bytes32 a, bytes32 b)
	public pure returns (bytes32){
		return keccak256(a,b);
	}

	function keccakString(string a, string i)
	public pure returns (bytes32){
		return keccak256(a, i);
	}

	function keccakSender()
	public view returns (bytes32){
		return keccak256(msg.sender);
	}

	function keccakAddressBytes(address adr, bytes32 byt)
	public pure returns (bytes32){
		return keccak256(adr, byt);
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
}