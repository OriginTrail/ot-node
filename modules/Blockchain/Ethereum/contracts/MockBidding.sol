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

contract MockEscrowHolder {
	function initiateEscrow(address DC_wallet, address DH_wallet, uint data_id, uint token_amount,uint stake_amount, uint total_time) public;
}

contract MockBidding {
	using SafeMath for uint256;

	ERC20 public token;
	MockEscrowHolder public escrow;

	function MockBidding(address tokenAddress, address escrowAddress)
	public {
		require ( tokenAddress != address(0) && escrowAddress != address(0));
		token = ERC20(tokenAddress);
		escrow = MockEscrowHolder(escrowAddress);
	}

	struct OfferDefinition{
		//Parameters of one escrow
		uint total_escrow_time;
		uint max_token_amount;
		uint min_stake_amount; 
		uint min_reputation;

		//Parameters for the bidding 
		bytes32 data_hash;
		uint required_number_of_bids;
		uint replication_factor; //Number of DH's that will be sent an escrow request

		//Parameters of the data
		uint data_size;

		//Parameters for use during the bidding mechanism
		uint256 number_of_bids;
		bool active;
		bool finalized;
	}

	struct DHProfileDefinition{
		//Offer Parameters
		uint token_amount; //Per byte per minute
		uint stake_amount; //Per byte per minute

		uint balance;

		uint max_escrow_time;
		uint size_available;

		uint reputation;
	}

	struct BidListElem{
		address DH_wallet;
		uint DH_node_id;
		bool canceled;
		bool chosen;
	}

	mapping(address => mapping(uint => mapping(uint => BidListElem))) public bid;
	mapping(address => mapping(uint => OfferDefinition)) public offer; //offer[DC_address][nonce/import_id/...]
	mapping(address => mapping(uint => DHProfileDefinition)) public DH_profile; //DH_profile[DH_address][DH_node_id]

	event OfferCreated(address DC_wallet,uint DC_node_id, uint data_id, uint total_escrow_time, uint max_token_amount, uint min_stake_amount,uint min_reputation, uint data_size, bytes32 data_hash);
	event OfferCanceled(address DC_wallet, uint data_id);
	event AddedBid(address DC_wallet,uint data_id, uint bidIndex, address DH_wallet, uint node_id);
	event BidTaken(address DC_wallet, address DH_wallet, uint data_id);
	event OfferFinalized(address DC_wallet,uint data_id);


	function createOffer(
		uint data_id, //nonce/import_id/... 
		uint DC_node_id,

		uint total_escrow_time, 
		uint max_token_amount,
		uint min_stake_amount,
		uint min_reputation,

		bytes32 data_hash,

		uint required_number_of_bids, 
		uint replication_factor,

		uint data_size) public {

		offer[msg.sender][data_id].total_escrow_time = total_escrow_time;
		offer[msg.sender][data_id].max_token_amount = max_token_amount;
		offer[msg.sender][data_id].min_stake_amount = min_stake_amount;
		offer[msg.sender][data_id].min_reputation = min_reputation;

		offer[msg.sender][data_id].data_hash = data_hash;

		offer[msg.sender][data_id].required_number_of_bids = required_number_of_bids;
		offer[msg.sender][data_id].replication_factor = replication_factor;

		offer[msg.sender][data_id].data_size = data_size;
		
		offer[msg.sender][data_id].number_of_bids = 0;
		offer[msg.sender][data_id].active = true;
		offer[msg.sender][data_id].finalized = false;

		emit OfferCreated(msg.sender, DC_node_id, data_id, total_escrow_time, max_token_amount, min_stake_amount, min_reputation, data_size, data_hash);
	}

	function cancelOffer(uint DC_node_id, uint data_id) public {
		offer[msg.sender][data_id].active = false;
		emit OfferCanceled(msg.sender, data_id);
	}

	function addBid(address DC_wallet, uint data_id, uint DH_node_id) public returns (uint) {

		OfferDefinition storage this_offer = offer[DC_wallet][data_id];
		uint bid_index = this_offer.number_of_bids;
		this_offer.number_of_bids = this_offer.number_of_bids + 1;

		BidListElem storage this_bid = bid[DC_wallet][data_id][bid_index];

		this_bid.DH_wallet = msg.sender;
		this_bid.DH_node_id = DH_node_id;

		emit AddedBid(DC_wallet, data_id, bid_index, msg.sender, DH_node_id);
		return bid_index;
	}	

	function getBidIndex(address DC_wallet, uint data_id, uint DH_node_id) public view returns (uint) {
		OfferDefinition storage this_offer = offer[DC_wallet][data_id];
		uint256 i = 0;
		while(i < this_offer.number_of_bids && (bid[DC_wallet][data_id][i].DH_wallet != msg.sender || bid[DC_wallet][data_id][i].DH_node_id != DH_node_id)) i = i + 1;
		if( i >= this_offer.number_of_bids) return 99999;
		else return i;
	}	
	
	function cancelBid(address DC_wallet, uint data_id, uint bid_index) public{
		bid[DC_wallet][data_id][bid_index].canceled = true;
	}

	function chooseBids(uint data_id) public returns (uint256[] chosen_data_holders){
		OfferDefinition storage this_offer = offer[msg.sender][data_id];
		uint256 i = 0;
		while(i < this_offer.replication_factor){
			chosen_data_holders[i] = i;

			//Inicijalizacija escrow-a
			BidListElem storage this_bid = bid[msg.sender][data_id][i];
			DHProfileDefinition storage chosenDH = DH_profile[this_bid.DH_wallet][this_bid.DH_node_id];

			uint scope = this_offer.total_escrow_time * this_offer.data_size;
			uint stake_amount = chosenDH.stake_amount * scope;
			uint token_amount = chosenDH.token_amount * scope;
			
			escrow.initiateEscrow(msg.sender, this_bid.DH_wallet, data_id, token_amount, stake_amount, this_offer.total_escrow_time);
			this_bid.chosen = true;
			emit BidTaken(msg.sender, bid[msg.sender][data_id][i].DH_wallet,data_id);

			i = i + 1;
		}
	}
	function isBidChosen(address DC_wallet, uint data_id, uint bid_index) public view returns(bool){
		return bid[DC_wallet][data_id][bid_index].chosen;
	}

	function createProfile(uint node_id, uint price, uint stake, uint max_time, uint max_size) public{
		DHProfileDefinition storage this_DH = DH_profile[msg.sender][node_id];
		this_DH.token_amount = price;
		this_DH.stake_amount = stake;
		this_DH.max_escrow_time = max_time;
		this_DH.size_available = max_size;
	}
	function setPrice(uint node_id, uint new_price) public {
		DH_profile[msg.sender][node_id].token_amount = new_price;
	}
	function setStake(uint node_id, uint new_stake) public {
		DH_profile[msg.sender][node_id].stake_amount = new_stake;
	}
	function setMaxTime(uint node_id, uint new_max_time) public {
		DH_profile[msg.sender][node_id].max_escrow_time = new_max_time;
	}
	function setFreeSpace(uint node_id, uint new_space) public {
		DH_profile[msg.sender][node_id].size_available = new_space;
	}
	function increaseBalance(uint node_id, uint amount) public {
		uint amount_to_transfer = amount;
		amount = 0;
		token.transferFrom(msg.sender, this, amount_to_transfer);
		DH_profile[msg.sender][node_id].balance = DH_profile[msg.sender][node_id].balance + amount;
	}
	function decreaseBalance(uint node_id, uint amount) public {
		uint amount_to_transfer = amount;
		amount = 0;
		token.transfer(msg.sender, amount_to_transfer);
		DH_profile[msg.sender][node_id].balance = DH_profile[msg.sender][node_id].balance - amount;
	}
}