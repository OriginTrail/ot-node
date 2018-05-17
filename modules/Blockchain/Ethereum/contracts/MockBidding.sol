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
		
		uint data_size;

		//Parameters for the bidding 
		bytes32 data_hash;
		uint first_bid_index;

		uint required_number_of_bids; 
		uint256 number_of_bids;
		uint replication_factor;

		bool active;
		bool finalized;
	}

	struct ProfileDefinition{
		//Offer Parameters
		uint token_amount; //Per byte per minute
		uint stake_amount; //Per byte per minute

		uint balance;
		uint reputation;

		uint max_escrow_time;
		uint size_available;

	}

	struct BidListElem{
		address DH_wallet;
		uint DH_node_id;
		bool canceled;
		bool chosen;
	}

	mapping(bytes32 => mapping(uint => BidListElem)) public bid; // bid[offer_hash][bid_index]
	mapping(bytes32 => OfferDefinition) public offer; //offer[offer_hash] offer_hash = keccak256(DC_wallet, DC_node_id, nonce)
	mapping(address => ProfileDefinition) public profile; //profile[wallet]

	event OfferCreated(bytes32 offer_hash, uint total_escrow_time, uint max_token_amount, uint min_stake_amount,uint min_reputation, uint data_size, bytes32 data_hash);
	event OfferCanceled(bytes32 offer_hash);
	event AddedBid(bytes32 offer_hash, uint bidIndex, address DH_wallet, uint node_id);
	event BidTaken(bytes32 offer_hash, address DH_wallet);
	event OfferFinalized(bytes32 offer_hash);


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

		bytes32 offer_hash = keccak256(msg.sender, DC_node_id, data_id);

		offer[offer_hash].total_escrow_time = total_escrow_time;
		offer[offer_hash].max_token_amount = max_token_amount;
		offer[offer_hash].min_stake_amount = min_stake_amount;
		offer[offer_hash].min_reputation = min_reputation;

		offer[offer_hash].data_hash = data_hash;

		offer[offer_hash].required_number_of_bids = required_number_of_bids;
		offer[offer_hash].replication_factor = replication_factor;

		offer[offer_hash].data_size = data_size;
		
		offer[offer_hash].number_of_bids = 0;
		offer[offer_hash].active = true;
		offer[offer_hash].finalized = false;

		emit OfferCreated(offer_hash, total_escrow_time, max_token_amount, min_stake_amount, min_reputation, data_size, data_hash);
	}

	function cancelOffer(bytes32 offer_hash) public {
		offer[offer_hash].active = false;
		emit OfferCanceled(offer_hash);
	}

	function addBid(bytes32 offer_hash, uint DH_node_id) public returns (uint) {

		OfferDefinition storage this_offer = offer[offer_hash];
		uint bid_index = this_offer.number_of_bids;
		this_offer.number_of_bids = this_offer.number_of_bids + 1;

		BidListElem storage this_bid = bid[offer_hash][bid_index];

		this_bid.DH_wallet = msg.sender;
		this_bid.DH_node_id = DH_node_id;

		emit AddedBid(offer_hash, bid_index, msg.sender, DH_node_id);

		return bid_index;
	}	

	function getBidIndex(bytes32 offer_hash, uint DH_node_id) public view returns (uint) {
		OfferDefinition storage this_offer = offer[offer_hash];
		uint256 i = 0;
		while(i < this_offer.number_of_bids && (bid[offer_hash][i].DH_wallet != msg.sender || bid[offer_hash][i].DH_node_id != DH_node_id)) i = i + 1;
		if( i >= this_offer.number_of_bids) return uint(-1);
		else return i;
	}	
	
	function cancelBid(bytes32 offer_hash, uint bid_index) public{
		bid[offer_hash][bid_index].canceled = true;
	}

	function chooseBids(bytes32 offer_hash) public returns (uint256[] chosen_data_holders){
		OfferDefinition storage this_offer = offer[offer_hash];
		uint256 i = 0;
		while(i < this_offer.replication_factor){
			chosen_data_holders[i] = i;

			//Inicijalizacija escrow-a
			BidListElem storage this_bid = bid[offer_hash][i];
			ProfileDefinition storage chosenDH = profile[this_bid.DH_wallet];

			uint scope = this_offer.total_escrow_time * this_offer.data_size;
			uint stake_amount = chosenDH.stake_amount * scope;
			uint token_amount = chosenDH.token_amount * scope;
			
			escrow.initiateEscrow(msg.sender, this_bid.DH_wallet, uint(offer_hash), token_amount, stake_amount, this_offer.total_escrow_time);
			this_bid.chosen = true;
			emit BidTaken(offer_hash, bid[offer_hash][i].DH_wallet);

			i = i + 1;
		}
		this_offer.finalized = true;
		OfferFinalized(offer_hash);
	}
	function isBidChosen(bytes32 offer_hash, uint bid_index) public view returns(bool){
		return bid[offer_hash][bid_index].chosen;
	}

	event ProfileCreated(address wallet, bytes32 node_id);

	function createProfile(bytes32 node_id, uint price, uint stake, uint max_time, uint max_size) public{
		ProfileDefinition storage this_DH = profile[msg.sender];
		this_DH.token_amount = price;
		this_DH.stake_amount = stake;
		this_DH.max_escrow_time = max_time;
		this_DH.size_available = max_size;
		emit ProfileCreated(msg.sender, node_id);
	}
	function setPrice(uint new_price) public {
		profile[msg.sender].token_amount = new_price;
	}
	function setStake(uint new_stake) public {
		profile[msg.sender].stake_amount = new_stake;
	}
	function setMaxTime(uint new_max_time) public {
		profile[msg.sender].max_escrow_time = new_max_time;
	}
	function setFreeSpace(uint new_space) public {
		profile[msg.sender].size_available = new_space;
	}
	function increaseBalance(uint amount) public {
		uint amount_to_transfer = amount;
		amount = 0;
		token.transferFrom(msg.sender, this, amount_to_transfer);
		profile[msg.sender].balance = profile[msg.sender].balance + amount;
	}
	function decreaseBalance(uint amount) public {
		uint amount_to_transfer = amount;
		amount = 0;
		token.transfer(msg.sender, amount_to_transfer);
		profile[msg.sender].balance = profile[msg.sender].balance - amount;
	}
	function getPrice(address wallet)
	public view returns (uint){
		return profile[wallet].token_amount;
	}
	function getStake(address wallet)
	public view returns (uint){
		return profile[wallet].stake_amount;
	}
	function getBalance(address wallet)
	public view returns (uint){
		return profile[wallet].balance;
	}
}