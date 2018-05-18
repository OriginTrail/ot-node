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
		address DC_wallet;

		//Parameters for DH filtering
		uint max_token_amount;
		uint min_stake_amount; 
		uint min_reputation;

		//Data holding parameters
		uint total_escrow_time;
		uint data_size;

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
		uint token_amount; //Per byte per minute
		uint stake_amount; //Per byte per minute

		uint balance;
		uint reputation;

		uint max_escrow_time;
		uint size_available;

		bool active;
	}

	struct BidDefinition{
		address DH_wallet;
		bytes32 DH_node_id;

		uint token_amount;
		uint stake_amount;

		uint256 distance;

		uint next_bid;

		bool active;
		bool chosen;
	}

	//mapping(bytes32 => mapping(uint => BidDefinition)) public bid; // bid[offer_hash][bid_index]
	mapping(bytes32 => OfferDefinition) public offer; //offer[offer_hash] offer_hash = keccak256(DC_wallet, DC_node_id, nonce)
	mapping(address => ProfileDefinition) public profile; //profile[wallet]

	event OfferCreated(bytes32 offer_hash, bytes32 DC_node_id, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint min_reputation, uint data_size, bytes32 data_hash);
	event OfferCanceled(bytes32 offer_hash);
	event AddedBid(bytes32 offer_hash, address DH_wallet, bytes32 DH_node_id, uint bid_index);
	event AddedPredeterminedBid(bytes32 offer_hash, address DH_wallet, bytes32 DH_node_id, uint bid_index, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint data_size);
	event FinalizeOfferReady(bytes32 offer_hash);
	event BidTaken(bytes32 offer_hash, address DH_wallet);
	event OfferFinalized(bytes32 offer_hash);


	function createOffer(
		uint256 data_id,
		bytes32 DC_node_id,

		uint256 total_escrow_time, 
		uint256 max_token_amount,
		uint256 min_stake_amount,
		uint256 min_reputation,

		bytes32 data_hash,
		uint256 data_size,

		address[] predetermined_DH_wallet,
		bytes32[] predetermined_DH_node_id)
	public {

		bytes32 offer_hash = keccak256(msg.sender, DC_node_id, data_id);

		offer[offer_hash].DC_wallet = msg.sender;

		offer[offer_hash].total_escrow_time = total_escrow_time;
		offer[offer_hash].max_token_amount = max_token_amount;
		offer[offer_hash].min_stake_amount = min_stake_amount;
		offer[offer_hash].min_reputation = min_reputation;

		offer[offer_hash].data_hash = data_hash;
		offer[offer_hash].data_size = data_size;

		offer[offer_hash].replication_factor = predetermined_DH_wallet.length;

		offer[offer_hash].active = true;
		offer[offer_hash].finalized = false;

		while(offer[offer_hash].bid.length < predetermined_DH_wallet.length) {
			BidDefinition memory bid_def = BidDefinition(predetermined_DH_wallet[offer[offer_hash].bid.length], predetermined_DH_node_id[offer[offer_hash].bid.length], 0, 0, 0, 0, false, false);
			offer[offer_hash].bid.push(bid_def);
			emit AddedPredeterminedBid(offer_hash, bid_def.DH_wallet, bid_def.DH_node_id, offer[offer_hash].bid.length - 1, total_escrow_time, max_token_amount, min_stake_amount, data_size);
		}

		emit OfferCreated(offer_hash, DC_node_id, total_escrow_time, max_token_amount, min_stake_amount, min_reputation, data_size, data_hash);
	}

	function cancelOffer(bytes32 offer_hash) public {
		offer[offer_hash].active = false;
		emit OfferCanceled(offer_hash);
	}

	function activatePredeterminedBid(bytes32 offer_hash, bytes32 DH_node_id, uint bid_index) 
	public{

		OfferDefinition storage this_offer = offer[offer_hash];
		ProfileDefinition storage this_DH = profile[msg.sender];
		BidDefinition storage this_bid = offer[offer_hash].bid[bid_index];

		uint scope = this_offer.total_escrow_time.mul(this_offer.data_size);
		this_bid.token_amount = this_DH.token_amount * scope;
		this_bid.stake_amount = this_DH.stake_amount * scope;
		this_bid.active = true;
	}

	function addBid(bytes32 offer_hash, bytes32 DH_node_id) 
	public returns (uint) {

		OfferDefinition storage this_offer = offer[offer_hash];
		ProfileDefinition storage this_DH = profile[msg.sender];
		BidDefinition memory new_bid = BidDefinition(msg.sender, DH_node_id, this_DH.token_amount * scope, this_DH.stake_amount * scope, 0, 0, true, false);
		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size * this_offer.total_escrow_time;

		this_offer.bid.push(new_bid);
		emit AddedBid(offer_hash, msg.sender, DH_node_id, this_offer.bid.length - 1);
		emit FinalizeOfferReady(offer_hash);
		return this_offer.bid.length - 1;
	}	

	function getBidIndex(bytes32 offer_hash, bytes32 DH_node_id) public view returns (uint) {
		OfferDefinition storage this_offer = offer[offer_hash];
		uint256 i = 0;
		while(i < this_offer.bid.length && (offer[offer_hash].bid[i].DH_wallet != msg.sender || offer[offer_hash].bid[i].DH_node_id != DH_node_id)) i = i + 1;
		if( i == this_offer.bid.length) return uint(-1);
		else return i;
	}	
	
	function cancelBid(bytes32 offer_hash, uint bid_index) public{
		offer[offer_hash].bid[bid_index].active = false;
	}

	function chooseBids(bytes32 offer_hash) public returns (uint256[] chosen_data_holders){
		OfferDefinition storage this_offer = offer[offer_hash];
		uint256 i = 0;
		while(i < this_offer.bid.length && i < this_offer.replication_factor.mul(2).add(1)){
			chosen_data_holders[i] = i;

			//Inicijalizacija escrow-a
			BidDefinition storage this_bid = offer[offer_hash].bid[i];
			ProfileDefinition storage chosenDH = profile[this_bid.DH_wallet];

			uint scope = this_offer.total_escrow_time * this_offer.data_size;
			uint stake_amount = chosenDH.stake_amount * scope;
			uint token_amount = chosenDH.token_amount * scope;
			
			escrow.initiateEscrow(msg.sender, this_bid.DH_wallet, uint(offer_hash), token_amount, stake_amount, this_offer.total_escrow_time);
			this_bid.chosen = true;
			emit BidTaken(offer_hash, this_bid.DH_wallet);
			i = i + 1;
		}
		this_offer.finalized = true;
		OfferFinalized(offer_hash);
	}
	function isBidChosen(bytes32 offer_hash, uint bid_index) public view returns(bool){
		return offer[offer_hash].bid[bid_index].chosen;
	}

	/*    ----------------------------- DH PROFILE -----------------------------    */

	event ProfileCreated(address wallet, bytes32 node_id);
	event BalanceModified(address wallet, uint new_balance);
	event ReputationModified(address wallet, uint new_balance);

	function createProfile(bytes32 node_id, uint price, uint stake, uint max_time, uint max_size) public{
		ProfileDefinition storage this_DH = profile[msg.sender];
		require(!this_DH.active);
		this_DH.active = true;
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