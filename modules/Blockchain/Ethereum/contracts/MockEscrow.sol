pragma solidity ^0.4.18;

library SafeMath {
	function mul(uint256 a, uint256 b) internal pure returns (uint256) {
		uint256 c = a * b;
		assert(a == 0 || c / a == b);
		return c;
	}

	function div(uint256 a, uint256 b) internal pure returns (uint256) {
		// assert(b > 0); // Solidity automatically throws when dividing by 0
		uint256 c = a / b;
		// assert(a == b * c + a % b); // There is no case in which this doesn't hold
		return c;
	}

	function sub(uint256 a, uint256 b) internal pure returns (uint256) {
		assert(b <= a);
		return a - b;
	}

	function add(uint256 a, uint256 b) internal pure returns (uint256) {
		uint256 c = a + b;
		assert(c >= a);
		return c;
	}
}
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
	function Ownable() public {
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
contract ERC20Basic {
	uint256 public totalSupply;
	function balanceOf(address who) public constant returns (uint256);
	function transfer(address to, uint256 value) public returns (bool);
	event Transfer(address indexed from, address indexed to, uint256 value);
}

contract ERC20 is ERC20Basic {
	function allowance(address owner, address spender) public constant returns (uint256);
	function transferFrom(address from, address to, uint256 value) public returns (bool);
	function approve(address spender, uint256 value) public returns (bool);
	event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract MockEscrowHolder is Ownable{
	using SafeMath for uint256;

	ERC20 public token;

	function MockEscrowHolder(address tokenAddress)
	public{
		require ( tokenAddress != address(0) );
		token = ERC20(tokenAddress);
	}


	/*    ----------------------------- ESCROW -----------------------------     */


	enum EscrowStatus {inactive, initiated, active, canceled, completed}

	struct EscrowDefinition{
		uint token_amount;
		uint tokens_sent;

		uint stake_amount;

		uint last_confirmation_time;
		uint end_time;
		uint total_time_in_seconds;

		bytes32 root_hash;
		uint256 checksum; 
		
		EscrowStatus escrow_status;
	}

	mapping(address => mapping(address => mapping(uint => EscrowDefinition))) public escrow;

	event EscrowInitated(address DC_wallet, address DH_wallet, uint data_id, uint token_amount, uint stake_amount,  uint total_time_in_seconds);
	event EscrowVerified(address DC_wallet, address DH_wallet, uint data_id, bool verification_successful);
	event EscrowCanceled(address DC_wallet, address DH_wallet, uint data_id);
	event EscrowCompleted(address DC_wallet, address DH_wallet, uint data_id);

	function initiateEscrow(address DC_wallet, address DH_wallet, uint data_id, uint token_amount, uint stake_amount,  uint total_time_in_minutes)
	public onlyOwner{
		EscrowDefinition this_escrow = escrow[DC_wallet][DH_wallet][data_id];
		 this_escrow.token_amount = token_amount;
		 this_escrow.tokens_sent = 0;
		 this_escrow.stake_amount = stake_amount;
		 this_escrow.last_confirmation_time = 0;
		 this_escrow.end_time = 0;
		 this_escrow.total_time_in_seconds = total_time_in_minutes.mul(60);
		 this_escrow.escrow_status = EscrowStatus.initiated;
		EscrowInitated(DC_wallet, DH_wallet, data_id, token_amount, stake_amount, total_time_in_minutes);
	}

	function writeRootHashAndKeyChecksum(uint data_id, address DC_wallet, bytes32 root_hash, uint EPKChecksum)
	public {
		EscrowDefinition this_escrow = escrow[DC_wallet][msg.sender][data_id];
		this_escrow.root_hash = root_hash;
		this_escrow.checksum = EPKChecksum;
	}

	function verifyEscrow(uint data_id, address DH_wallet)
	public returns (bool isVerified){
		isVerified = false;

		EscrowDefinition storage escrow_def = escrow[msg.sender][DH_wallet][data_id];

		// require(escrow_def.token_amount == token_amount &&
		// escrow_def.stake_amount == stake_amount &&
		// escrow_def.escrow_status == EscrowStatus.initiated &&
		// escrow_def.total_time_in_seconds == total_time_in_seconds);

		escrow_def.last_confirmation_time = block.timestamp;
		escrow_def.end_time = SafeMath.add(block.timestamp, escrow_def.total_time_in_seconds);

		escrow_def.escrow_status = EscrowStatus.active;
		isVerified = true;
		EscrowVerified(msg.sender, DH_wallet, data_id, isVerified);
	}

	function payOut(address DC_wallet, uint data_id)
	public{
		EscrowDefinition storage this_escrow = escrow[DC_wallet][msg.sender][data_id];

		//require(this_escrow.escrow_status == EscrowStatus.active);

		uint256 amount_to_send;
		if(this_escrow.escrow_status == EscrowStatus.active){
			uint end_time = block.timestamp;
			if(end_time > this_escrow.end_time){
				uint stake_to_send = this_escrow.stake_amount;
				this_escrow.stake_amount = 0;
				//if(stake_to_send > 0) token.transfer(msg.sender, stake_to_send);

				amount_to_send = SafeMath.sub(this_escrow.token_amount, this_escrow.tokens_sent);
				this_escrow.escrow_status = EscrowStatus.completed;
				EscrowCompleted(DC_wallet, msg.sender, data_id);
			}
			else{
				amount_to_send = SafeMath.mul(this_escrow.token_amount,SafeMath.sub(end_time,this_escrow.last_confirmation_time)) / this_escrow.total_time_in_seconds;
				this_escrow.last_confirmation_time = end_time;
			}
		}
		else {
			amount_to_send = SafeMath.sub(this_escrow.token_amount, this_escrow.tokens_sent);
			this_escrow.escrow_status = EscrowStatus.completed;
			EscrowCompleted(DC_wallet, msg.sender, data_id);
		}

		if(amount_to_send > 0) {
			this_escrow.tokens_sent.add(amount_to_send);
			//token.transfer(msg.sender,amount_to_send);
		}
	}

	function cancelEscrow(address DH_wallet, uint256 data_id)
	public {
		EscrowDefinition storage this_escrow = escrow[msg.sender][DH_wallet][data_id];

		// require(this_escrow.escrow_status != EscrowStatus.completed &&
		// this_escrow.escrow_status != EscrowStatus.canceled);

		uint256 amount_to_send;
		if(this_escrow.escrow_status == EscrowStatus.active){

			uint cancelation_time = block.timestamp;
			if(this_escrow.end_time < block.timestamp) cancelation_time = this_escrow.end_time;

			amount_to_send = SafeMath.mul(this_escrow.token_amount, SafeMath.sub(this_escrow.end_time,cancelation_time)) / this_escrow.total_time_in_seconds;
			this_escrow.escrow_status = EscrowStatus.canceled;
		}
		else {
			amount_to_send = this_escrow.token_amount;
			this_escrow.escrow_status = EscrowStatus.completed;
		}

		//Transfer the amount_to_send to DC 
		if(amount_to_send > 0) {
			this_escrow.tokens_sent.add(amount_to_send);
			//token.transfer(msg.sender, amount_to_send);
		}

		//Calculate the amount to send back to DH and transfer the money back
		amount_to_send = SafeMath.sub(this_escrow.token_amount, this_escrow.tokens_sent);
		if(amount_to_send > 0) {
			this_escrow.tokens_sent.add(amount_to_send);
			//token.transfer(msg.sender,amount_to_send);
		}

		uint stake_to_send = this_escrow.stake_amount;
		this_escrow.stake_amount = 0;
		//if(stake_to_send > 0) token.transfer(DH_wallet, stake_to_send);

		this_escrow.escrow_status = EscrowStatus.completed;
		EscrowCanceled(msg.sender, DH_wallet, data_id);
	}

}