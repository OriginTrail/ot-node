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

contract EscrowHolder {
	using SafeMath for uint256;

	ERC20 public token;

	/*    ----------------------------- ESCROW -----------------------------     */

	enum EscrowStatus {initiated, active, canceled, completed}

	struct EscrowDefinition{
		uint token_amount;
		uint tokens_sent;

		uint last_confirmation_time;
		uint end_time;
		uint total_time;

		EscrowStatus escrow_status;
	}

	mapping(address => mapping(address => mapping(uint => EscrowDefinition))) public escrow;

	event EscrowInitated(address DC_wallet, address DH_wallet, uint data_id);
	event EscrowVerified(address DC_wallet, address DH_wallet, uint data_id);
	event EscrowCanceled(address DC_wallet, address DH_wallet, uint data_id);
	event EscrowCompleted(address DC_wallet, address DH_wallet, uint data_id);

	function EscrowHolder(address tokenAddress)
	public{
		require ( tokenAddress != address(0) );
		token = ERC20(tokenAddress);
	}

	function initiateEscrow(address DH_wallet, uint data_id, uint token_amount,	uint total_time)
	public {
		require(escrow[msg.sender][DH_wallet][data_id].escrow_status != EscrowStatus.active
		&&  escrow[msg.sender][DH_wallet][data_id].escrow_status != EscrowStatus.canceled);

		require(token_amount > 0 && total_time > 0);

		require(token.allowance(msg.sender,this) >= token_amount);
		token.transferFrom(msg.sender,this,token_amount);

		escrow[msg.sender][DH_wallet][data_id] = EscrowDefinition(token_amount, 0, 0, 0, total_time, EscrowStatus.initiated);

		EscrowInitated(msg.sender, DH_wallet, data_id);
	}

	function verifyEscrow(address DC_wallet, uint data_id, uint token_amount, uint total_time)
	public returns (bool isVerified){
		isVerified = false;

		EscrowDefinition storage escrow_def = escrow[DC_wallet][msg.sender][data_id];

		require(escrow_def.token_amount == token_amount &&
		escrow_def.escrow_status == EscrowStatus.initiated &&
		escrow_def.total_time == total_time);

		escrow_def.last_confirmation_time = block.number;
		escrow_def.end_time = SafeMath.add(block.number, total_time);

		escrow_def.escrow_status = EscrowStatus.active;
		isVerified = true;
		EscrowVerified(DC_wallet, msg.sender, data_id);
	}

	function payOut(address DC_wallet, uint data_id)
	public{
		EscrowDefinition storage this_escrow = escrow[DC_wallet][msg.sender][data_id];

		require(this_escrow.escrow_status != EscrowStatus.initiated &&
		this_escrow.escrow_status != EscrowStatus.completed);

		uint256 amount_to_send;
		if(this_escrow.escrow_status == EscrowStatus.active){
			uint end_time = block.number;
			if(end_time > this_escrow.end_time){
				amount_to_send = SafeMath.sub(this_escrow.token_amount, this_escrow.tokens_sent);
				this_escrow.escrow_status = EscrowStatus.completed;
				EscrowCompleted(DC_wallet, msg.sender, data_id);
			}
			else{
				amount_to_send = SafeMath.mul(this_escrow.token_amount,SafeMath.sub(end_time,this_escrow.last_confirmation_time)) / this_escrow.total_time;
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
			token.transfer(msg.sender,amount_to_send);
		}
	}


	function cancelEscrow(address DH_wallet, uint256 data_id)
	public {
		EscrowDefinition storage this_escrow = escrow[msg.sender][DH_wallet][data_id];

		require(this_escrow.escrow_status != EscrowStatus.completed &&
		this_escrow.escrow_status != EscrowStatus.canceled);

		uint256 amount_to_send;
		if(this_escrow.escrow_status == EscrowStatus.active){
			uint cancelation_time = block.number;
			if(this_escrow.end_time < block.number) cancelation_time = this_escrow.end_time;
			amount_to_send = SafeMath.mul(this_escrow.token_amount, SafeMath.sub(this_escrow.end_time,cancelation_time)) / this_escrow.total_time;
			this_escrow.escrow_status = EscrowStatus.canceled;
		}
		else {
			amount_to_send = this_escrow.token_amount;
			this_escrow.escrow_status = EscrowStatus.completed;
		}

		if(amount_to_send > 0) this_escrow.tokens_sent.add(amount_to_send);

		if(this_escrow.tokens_sent == this_escrow.token_amount){
			this_escrow.escrow_status = EscrowStatus.completed;
		}
		else {
			this_escrow.escrow_status = EscrowStatus.canceled;
		}

		if(amount_to_send > 0) token.transfer(msg.sender, amount_to_send);
		EscrowCanceled(msg.sender, DH_wallet, data_id);
	}




}

