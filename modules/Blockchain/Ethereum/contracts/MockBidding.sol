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
	function initiateEscrow(address DC_wallet, address DH_wallet, bytes32 import_id, uint token_amount,uint stake_amount, uint total_time_in_minutes) public;
}

contract MockBidding {
	using SafeMath for uint256;

	ERC20 public token;
	MockEscrowHolder public escrow;
	address reading;

	function MockBidding(address tokenAddress, address escrowAddress, address readingAddress)
	public {
		token = ERC20(tokenAddress);
		escrow = MockEscrowHolder(escrowAddress);
		reading = readingAddress;
	}

struct OfferDefinition{
		address DC_wallet;

		//Parameters for DH filtering
		uint max_token_amount_per_DH;
		uint min_stake_amount_per_DH; 
		uint min_reputation;

		//Data holding parameters
		uint total_escrow_time_in_minutes;
		uint data_size_in_bytes;

		//Parameters for the bidding ranking
		bytes32 data_hash;
		uint first_bid_index;

		uint replication_factor;

		bool active;
		bool finalized;

		BidDefinition[] bid;
	}

	struct ProfileDefinition{
		//Offer Parameters
		uint token_amount_per_byte_minute; //Per byte per minute
		uint stake_amount_per_byte_minute; //Per byte per minute

		uint read_stake_factor;

		uint balance;
		uint reputation;

		uint max_escrow_time_in_minutes;
		uint size_available_in_bytes;

		bool active;
	}

	struct BidDefinition{
		address DH_wallet;
		bytes32 DH_node_id;

		uint token_amount_for_escrow;
		uint stake_amount_for_escrow;

		uint256 distance;

		uint next_bid;

		bool active;
		bool chosen;
	}

	//mapping(bytes32 => mapping(uint => BidDefinition)) public bid; // offer[import_id].bid[bid_index]
	mapping(bytes32 => OfferDefinition) public offer; //offer[import_id] import_id = keccak256(DC_wallet, DC_node_id, nonce)
	mapping(address => ProfileDefinition) public profile; //profile[wallet]

	event OfferCreated(bytes32 import_id, bytes32 DC_node_id, uint total_escrow_time_in_minutes, uint max_token_amount_per_DH, uint min_stake_amount_per_DH, uint min_reputation, uint data_size_in_bytes, bytes32 data_hash);
	event OfferCanceled(bytes32 import_id);
	event AddedBid(bytes32 import_id, address DH_wallet, bytes32 DH_node_id, uint bid_index);
	event AddedPredeterminedBid(bytes32 import_id, address DH_wallet, bytes32 DH_node_id, uint bid_index, uint total_escrow_time_in_minutes, uint max_token_amount_per_DH, uint min_stake_amount_per_DH, uint data_size_in_bytes);
	event FinalizeOfferReady(bytes32 import_id);
	event BidTaken(bytes32 import_id, address DH_wallet);
	event OfferFinalized(bytes32 import_id);

	/*    ----------------------------- OFFERS -----------------------------     */

	function createOffer(
		bytes32 import_id,
		bytes32 DC_node_id,

		uint total_escrow_time_in_minutes, 
		uint max_token_amount_per_DH,
		uint min_stake_amount_per_DH,
		uint min_reputation,

		bytes32 data_hash,
		uint data_size_in_bytes,

		address[] predetermined_DH_wallet,
		bytes32[] predetermined_DH_node_id)
	public {
	    OfferDefinition storage this_offer = offer[import_id];
		this_offer.DC_wallet = msg.sender;

		this_offer.total_escrow_time_in_minutes = total_escrow_time_in_minutes;
		this_offer.max_token_amount_per_DH = max_token_amount_per_DH;
		this_offer.min_stake_amount_per_DH = min_stake_amount_per_DH;
		this_offer.min_reputation = min_reputation;

		this_offer.data_hash = data_hash;
		this_offer.data_size_in_bytes = data_size_in_bytes;

		this_offer.replication_factor = predetermined_DH_wallet.length;

	    this_offer.active = true;
		this_offer.finalized = false;

		while(offer[import_id].bid.length < predetermined_DH_wallet.length) {
			BidDefinition memory bid_def = BidDefinition(predetermined_DH_wallet[this_offer.bid.length], predetermined_DH_node_id[this_offer.bid.length], 0, 0, 0, 0, false, false);
			this_offer.bid.push(bid_def);
			emit AddedPredeterminedBid(import_id, bid_def.DH_wallet, bid_def.DH_node_id, this_offer.bid.length - 1, total_escrow_time_in_minutes, max_token_amount_per_DH, min_stake_amount_per_DH, data_size_in_bytes);	
		}

		emit OfferCreated(import_id, DC_node_id, total_escrow_time_in_minutes, max_token_amount_per_DH, min_stake_amount_per_DH, min_reputation, data_size_in_bytes, data_hash);
	}

	function cancelOffer(bytes32 import_id) public {
		offer[import_id].active = false;
		emit OfferCanceled(import_id);
	}

	function activatePredeterminedBid(bytes32 import_id, bytes32 DH_node_id, uint bid_index) 
	public{

		OfferDefinition storage this_offer = offer[import_id];
		ProfileDefinition storage this_DH = profile[msg.sender];
		BidDefinition storage this_bid = offer[import_id].bid[bid_index];

		this_bid.DH_node_id = DH_node_id; 

		uint scope = this_offer.total_escrow_time_in_minutes.mul(this_offer.data_size_in_bytes);
		this_bid.token_amount_for_escrow = this_DH.token_amount_per_byte_minute * scope;
		this_bid.stake_amount_for_escrow = this_DH.stake_amount_per_byte_minute * scope;
		this_bid.active = true;
	}

	function addBid(bytes32 import_id, bytes32 DH_node_id) 
	public returns (uint) {
		OfferDefinition storage this_offer = offer[import_id];
		ProfileDefinition storage this_DH = profile[msg.sender];
		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size_in_bytes * this_offer.total_escrow_time_in_minutes;
		BidDefinition memory new_bid = BidDefinition(msg.sender, DH_node_id, this_DH.token_amount_per_byte_minute * scope, this_DH.stake_amount_per_byte_minute * scope, 0, 0, true, false);

		this_offer.bid.push(new_bid);
		emit AddedBid(import_id, msg.sender, DH_node_id, this_offer.bid.length - 1);
		emit FinalizeOfferReady(import_id);
		return this_offer.bid.length - 1;
	}	

	function getBidIndex(bytes32 import_id, bytes32 DH_node_id) public view returns (uint) {
		OfferDefinition storage this_offer = offer[import_id];
		uint256 i = 0;
		while(i < this_offer.bid.length && (offer[import_id].bid[i].DH_wallet != msg.sender || offer[import_id].bid[i].DH_node_id != DH_node_id)) i = i + 1;
		if( i == this_offer.bid.length) return uint(-1);
		else return i;
	}	
	
	function cancelBid(bytes32 import_id, uint bid_index) public{
		offer[import_id].bid[bid_index].active = false;
	}

	function chooseBids(bytes32 import_id) public returns (uint256[] chosen_data_holders){
		OfferDefinition storage this_offer = offer[import_id];
		uint256 i = 0;
		while(i < this_offer.bid.length && i < this_offer.replication_factor.mul(2).add(1)){
			chosen_data_holders[i] = i;

			//Inicijalizacija escrow-a
			BidDefinition storage this_bid = offer[import_id].bid[i];
			
			escrow.initiateEscrow(msg.sender, this_bid.DH_wallet, import_id, this_bid.token_amount_for_escrow, this_bid.stake_amount_for_escrow, this_offer.total_escrow_time_in_minutes);
			this_bid.chosen = true;
			emit BidTaken(import_id, this_bid.DH_wallet);
			i = i + 1;
		}
		this_offer.finalized = true;
		emit OfferFinalized(import_id);
	}
	function isBidChosen(bytes32 import_id, uint bid_index) public view returns(bool){
		return offer[import_id].bid[bid_index].chosen;
	}

	/*    ----------------------------- DH PROFILE -----------------------------    */

	event ProfileCreated(address wallet, bytes32 node_id);
	event BalanceModified(address wallet, uint new_balance);
	event ReputationModified(address wallet, uint new_balance);

	function createProfile(bytes32 node_id, uint price, uint stake, uint max_time_in_minutes, uint max_size_in_bytes) public{
		ProfileDefinition storage this_DH = profile[msg.sender];
		require(!this_DH.active);
		this_DH.active = true;
		this_DH.token_amount_per_byte_minute = price;
		this_DH.stake_amount_per_byte_minute = stake;
		this_DH.max_escrow_time_in_minutes = max_time_in_minutes;
		this_DH.size_available_in_bytes = max_size_in_bytes;
		emit ProfileCreated(msg.sender, node_id);
	}
	function setPrice(uint new_price_per_byte_minute) public {
		profile[msg.sender].token_amount_per_byte_minute = new_price_per_byte_minute;
	}
	function setStake(uint new_stake_per_byte_minute) public {
		profile[msg.sender].stake_amount_per_byte_minute = new_stake_per_byte_minute;
	}
	function setMaxTime(uint new_max_time_in_minutes) public {
		profile[msg.sender].max_escrow_time_in_minutes = new_max_time_in_minutes;
	}
	function setFreeSpace(uint new_space_in_bytes) public {
		profile[msg.sender].size_available_in_bytes = new_space_in_bytes;
	}

	function depositToken(uint amount) public {
		require(token.balanceOf(msg.sender) >= amount && token.allowance(msg.sender, this) >= amount);
		uint amount_to_transfer = amount;
		amount = 0;
		if(amount_to_transfer > 0) token.transferFrom(msg.sender, this, amount_to_transfer);
		profile[msg.sender].balance = profile[msg.sender].balance.add(amount);
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
	}

	function withdrawToken(uint amount) public {
		uint256 amount_to_transfer;
		if(profile[msg.sender].balance >= amount){
			amount_to_transfer = amount;
			profile[msg.sender].balance = profile[msg.sender].balance.sub(amount);
		}
		else{ 
			amount_to_transfer = profile[msg.sender].balance;
			profile[msg.sender].balance = 0;
		}
		amount = 0;
		if(amount_to_transfer > 0) token.transfer(msg.sender, amount_to_transfer);
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
	}

	function increaseBalance(uint amount) public {
		profile[msg.sender].balance = profile[msg.sender].balance.add(amount);
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
	}
	function decreaseBalance(uint amount) public {
		if(profile[msg.sender].balance >= amount){
			profile[msg.sender].balance = profile[msg.sender].balance.sub(amount);
		}
		else {
			profile[msg.sender].balance = 0;
		}
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
	}

	function increaseReputation(address wallet, uint amount) public {
		profile[wallet].reputation = profile[wallet].reputation.add(amount);
		emit ReputationModified(wallet, profile[wallet].reputation);
	}

	function getPrice(address wallet)
	public view returns (uint){
		return profile[wallet].token_amount_per_byte_minute;
	}

	function getStake(address wallet)
	public view returns (uint){
		return profile[wallet].stake_amount_per_byte_minute;
	}

	function getBalance(address wallet)
	public view returns (uint){
		return profile[wallet].balance;
	}
}