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
	function initiateEscrow(address DC_wallet, address DH_wallet, uint data_id, uint token_amount,uint stake_amount, uint total_time) public;
}

contract BiddingTest {
	using SafeMath for uint256;

	ERC20 public token;
	EscrowHolder public escrow;

	modifier onlyEscrow() {
		require(EscrowHolder(msg.sender) == escrow);
		_;
	}
	
	function BiddingTest(address tokenAddress, address escrowAddress)
	public{
		require ( tokenAddress != address(0) && escrowAddress != address(0));
		token = ERC20(tokenAddress);
		escrow = EscrowHolder(escrowAddress);
	}


	/*    ----------------------------- BIDDING -----------------------------     */


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

	//mapping(bytes32 => mapping(uint => BidDefinition)) public bid; // offer[offer_hash].bid[bid_index]
	mapping(bytes32 => OfferDefinition) public offer; //offer[offer_hash] offer_hash = keccak256(DC_wallet, DC_node_id, nonce)
	mapping(address => ProfileDefinition) public profile; //profile[wallet]

	event OfferCreated(bytes32 offer_hash, bytes32 DC_node_id, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint min_reputation, uint data_size, bytes32 data_hash);
	event OfferCanceled(bytes32 offer_hash);
	event AddedBid(bytes32 offer_hash, address DH_wallet, bytes32 DH_node_id, uint bid_index);
	event AddedPredeterminedBid(bytes32 offer_hash, address DH_wallet, bytes32 DH_node_id, uint bid_index, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint data_size);
	event FinalizeOfferReady(bytes32 offer_hash);
	event BidTaken(bytes32 offer_hash, address DH_wallet);
	event OfferFinalized(bytes32 offer_hash);

	/*    ----------------------------- OFFERS -----------------------------     */

	function createOffer(
		uint data_id,
		bytes32 DC_node_id,

		uint total_escrow_time, 
		uint max_token_amount,
		uint min_stake_amount,
		uint min_reputation,

		bytes32 data_hash,
		uint data_size,

		address[] predetermined_DH_wallet,
		bytes32[] predetermined_DH_node_id)
	public returns (bytes32 offer_hash){

		offer_hash = keccak256(msg.sender, DC_node_id, data_id);

		require(max_token_amount > 0 && total_escrow_time > 0 && data_size > 0);
		require(offer[offer_hash].active == false);

		require(profile[msg.sender].balance >= max_token_amount.mul(predetermined_DH_wallet.length.mul(2).add(1));
		profile[msg.sender].balance = profile[msg.sender].balance.sub(max_token_amount.mul(predetermined_DH_wallet.length.mul(2).add(1)));
		emit BalanceModified(msg.sender, profile[msg.sender].balance);

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

		offer[offer_hash].first_bid_index = uint(-1);

		//Writing the predetermined DC into the bid list
		while(offer[offer_hash].bid.length < predetermined_DH_wallet.length) {
			BidDefinition memory bid_def = BidDefinition(predetermined_DH_wallet[offer[offer_hash].bid.length], predetermined_DH_node_id[offer[offer_hash].bid.length], 0, 0, 0, 0, false, false);
			offer[offer_hash].bid.push(bid_def);
			emit AddedPredeterminedBid(offer_hash, bid_def.DH_wallet, bid_def.DH_node_id, offer[offer_hash].bid.length - 1, total_escrow_time, max_token_amount, min_stake_amount, data_size);
		}

		emit OfferCreated(offer_hash, DC_node_id, total_escrow_time, max_token_amount, min_stake_amount, min_reputation, data_size, data_hash);
	}

	//TODO Decide when and under which conditions DC can cancel an offer
	function cancelOffer(bytes32 offer_hash)
	public{
		OfferDefinition storage this_offer = offer[offer_hash];
		require(this_offer.active && this_offer.DC_wallet == msg.sender);
		this_offer.active = false;
		uint max_total_token_amount = this_offer.max_token_amount.mul(this_offer.total_escrow_time).mul(this_offer.data_size);
		profile[msg.sender].balance = profile[msg.sender].balance.add(max_total_token_amount);
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
		emit OfferCanceled(offer_hash);
	}

	function activatePredeterminedBid(bytes32 offer_hash, bytes32 DH_node_id, uint bid_index) 
	public{
		require(offer[offer_hash].active && !offer[offer_hash].finalized);
		
		OfferDefinition storage this_offer = offer[offer_hash];
		ProfileDefinition storage this_DH = profile[msg.sender];
		BidDefinition storage this_bid = offer[offer_hash].bid[bid_index];

		require(this_bid.DH_wallet == msg.sender && this_bid.DH_node_id == DH_node_id);

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size * this_offer.total_escrow_time;
		require(this_offer.total_escrow_time <= this_DH.max_escrow_time);
		require(this_offer.max_token_amount  >= this_DH.token_amount * scope);
		require((this_offer.min_stake_amount  <= this_DH.stake_amount * scope) && (this_DH.stake_amount * scope <= profile[msg.sender].balance));
		require(this_offer.data_size		 <= this_DH.size_available);

		//Write the required data for the bid
		this_bid.token_amount = this_DH.token_amount * scope;
		this_bid.stake_amount = this_DH.stake_amount * scope;
		this_bid.active = true;
	}

	function addBid(bytes32 offer_hash, bytes32 DH_node_id)
	public returns (uint this_bid_index){
		require(offer[offer_hash].active && !offer[offer_hash].finalized);

		OfferDefinition storage this_offer = offer[offer_hash];
		ProfileDefinition storage this_DH = profile[msg.sender];

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size * this_offer.total_escrow_time;
		require(this_offer.total_escrow_time <= this_DH.max_escrow_time);
		require(this_offer.max_token_amount  >= this_DH.token_amount * scope);
		require((this_offer.min_stake_amount  <= this_DH.stake_amount * scope) && (this_DH.stake_amount * scope <= profile[msg.sender].balance));
		require(this_offer.min_reputation 	 <= profile[msg.sender].reputation);
		require(this_offer.data_size		 <= this_DH.size_available);

		//Create new bid in the list
		this_bid_index = this_offer.bid.length;
		BidDefinition memory new_bid = BidDefinition(msg.sender, DH_node_id, this_DH.token_amount * scope, this_DH.stake_amount * scope, 0, uint(-1), true, false);

		// distance = | hash(wallet, node_id) + token_amount - data_hash - stake_amount |
		new_bid.distance = absoluteDifference(uint256(keccak256(msg.sender, DH_node_id)).add(new_bid.token_amount),uint256(this_offer.data_hash).add(new_bid.stake_amount));


		//Insert the bid in the proper place in the list
		if(this_offer.first_bid_index == uint(-1)){
			this_offer.first_bid_index = this_bid_index;
			this_offer.bid.push(new_bid);
		}
		else{
			uint256 current_index = this_offer.first_bid_index;
			if(this_offer.bid[current_index].distance > new_bid.distance){
				this_offer.first_bid_index = this_bid_index;
				new_bid.next_bid = current_index;
				this_offer.bid.push(new_bid);
			}
			else {
				while(this_offer.bid[current_index].next_bid != uint(-1) && this_offer.bid[current_index].distance <= new_bid.distance){
					current_index = this_offer.bid[current_index].next_bid;
				}
				if(this_offer.bid[current_index].next_bid == uint(-1)){
					this_offer.bid[current_index].next_bid = this_bid_index;
					this_offer.bid.push(new_bid);
				}
				else{
					new_bid.next_bid = this_offer.bid[current_index].next_bid;
					this_offer.bid[current_index].next_bid = this_bid_index;
					this_offer.bid.push(new_bid);
				}
			}
		}

		if(this_offer.bid.length >= this_offer.replication_factor.mul(3).add(1)) emit FinalizeOfferReady(offer_hash);

		emit AddedBid(offer_hash, msg.sender, DH_node_id, this_bid_index);
		return this_bid_index;
	}

	function getBidIndex(bytes32 offer_hash, bytes32 DH_node_id) public view returns(uint){
		OfferDefinition storage this_offer = offer[offer_hash];
		uint256 i = 0;
		while(i < this_offer.bid.length && (offer[offer_hash].bid[i].DH_wallet != msg.sender || offer[offer_hash].bid[i].DH_node_id != DH_node_id)) i = i + 1;
		if( i == this_offer.bid.length) return uint(-1);
		else return i;
	}

	function cancelBid(bytes32 offer_hash, uint bid_index)
	public{
		require(offer[offer_hash].bid[bid_index].DH_wallet == msg.sender);
		offer[offer_hash].bid[bid_index].active = false;
	}

	function chooseBids(bytes32 offer_hash) public returns (uint256[] chosen_data_holders){

		OfferDefinition storage this_offer = offer[offer_hash];
		require(this_offer.active && !this_offer.finalized);
		require(this_offer.replication_factor.mul(3).add(1) <= this_offer.bid.length);

		chosen_data_holders = new uint256[](this_offer.replication_factor.mul(2).add(1));

		uint256 i;
		uint256 current_index = 0;

		uint256 token_amount_sent = 0;
		uint256 max_total_token_amount = this_offer.max_token_amount.mul(this_offer.total_escrow_time).mul(this_offer.data_size).mul(this_offer.replication_factor.mul(2).add(1));

		//Sending escrow requests to predetermined bids
		for(i = 0; i < this_offer.replication_factor; i = i + 1){
			BidDefinition storage chosen_bid = this_offer.bid[i];
			ProfileDefinition storage chosen_DH = profile[chosen_bid.DH_wallet];				

			if(profile[chosen_bid.DH_wallet].balance >= chosen_bid.stake_amount && chosen_bid.active && profile[chosen_bid.DH_wallet].size_available >= this_offer.data_size){
				//Initiating new escrow
				escrow.initiateEscrow(msg.sender, chosen_bid.DH_wallet, uint(offer_hash), chosen_bid.token_amount, chosen_bid.stake_amount, this_offer.total_escrow_time);

				token_amount_sent = token_amount_sent.add(chosen_bid.token_amount);

				//chosen_DH.size_available = chosen_DH.size_available.sub(this_offer.data_size);

				chosen_bid.chosen = true;
				chosen_data_holders[current_index] = i;
				current_index = current_index + 1;

				emit BidTaken(offer_hash, chosen_bid.DH_wallet);
			}
		}		

		//Sending escrow requests to network bids
		uint256 bid_index = this_offer.first_bid_index;
		while(current_index < this_offer.replication_factor.mul(2).add(1)) {

			while(bid_index != uint(-1) && !this_offer.bid[bid_index].active){
				bid_index = this_offer.bid[bid_index].next_bid;
			} 
			if(bid_index == uint(-1)) break;

			chosen_bid = this_offer.bid[bid_index];
			chosen_DH = profile[chosen_bid.DH_wallet];

			if(profile[chosen_bid.DH_wallet].balance >= chosen_bid.stake_amount && profile[chosen_bid.DH_wallet].size_available >= this_offer.data_size){
				//Initiating new escrow
				escrow.initiateEscrow(msg.sender, chosen_bid.DH_wallet, uint(offer_hash), chosen_bid.token_amount, chosen_bid.stake_amount, this_offer.total_escrow_time);

				token_amount_sent = token_amount_sent.add(chosen_bid.token_amount);

				chosen_bid.chosen = true;
				chosen_data_holders[current_index] = bid_index;
				current_index = current_index + 1;
				bid_index = this_offer.bid[bid_index].next_bid;

				emit BidTaken(offer_hash, chosen_bid.DH_wallet);
			}
			else{
				chosen_bid.active = false;
			}
		}

		offer[offer_hash].finalized = true;

		profile[msg.sender].balance = profile[msg.sender].balance.add(max_total_token_amount.sub(token_amount_sent));
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
		emit OfferFinalized(offer_hash); 
	}


	function isBidChosen(bytes32 offer_hash, uint bid_index) public constant returns (bool _isBidChosen){
		return offer[offer_hash].bid[bid_index].chosen;
	}

	function getOfferStatus(bytes32 offer_hash) public constant returns (bool isOfferFinal){
		return offer[offer_hash].finalized;
	}

	/*    ----------------------------- PROFILE -----------------------------    */

	event ProfileCreated(address wallet, bytes32 node_id);
	event BalanceModified(address wallet, uint new_balance);
	event ReputationModified(address wallet, uint new_balance);

	function createProfile(bytes32 node_id, uint price, uint stake, uint max_time, uint max_size) public{
		ProfileDefinition storage this_profile = profile[msg.sender];
		require(!this_profile.active);
		this_profile.active = true;
		this_profile.token_amount = price;
		this_profile.stake_amount = stake;
		this_profile.max_escrow_time = max_time;
		this_profile.size_available = max_size;
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
		if(amount_to_transfer > 0) {
			token.transferFrom(msg.sender, this, amount_to_transfer);
			profile[msg.sender].balance = profile[msg.sender].balance.add(amount_to_transfer);
			emit BalanceModified(msg.sender, profile[msg.sender].balance);
		}
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
		if(amount_to_transfer > 0){
			token.transfer(msg.sender, amount_to_transfer);
			emit BalanceModified(msg.sender, profile[msg.sender].balance);
		} 
	}

	function increaseBalance(address wallet, uint amount) public onlyEscrow {
		profile[wallet].balance = profile[wallet].balance.add(amount);
		emit BalanceModified(wallet, profile[wallet].balance);
	}

	function decreaseBalance(address wallet, uint amount) public onlyEscrow {
		require(profile[wallet].balance >= amount);
		profile[wallet].balance = profile[wallet].balance.sub(amount);
		emit BalanceModified(wallet, profile[wallet].balance);
	}

	function increaseReputation(address wallet, uint amount) public onlyEscrow {
		profile[wallet].reputation = profile[wallet].reputation.add(amount);
		emit ReputationModified(wallet, profile[wallet].reputation);
	}

	function absoluteDifference(uint256 a, uint256 b) public pure returns (uint256) {
		if (a > b) return a-b;
		else return b-a;
	}
}