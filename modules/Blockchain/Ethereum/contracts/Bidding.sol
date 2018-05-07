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

contract Bidding {
	using SafeMath for uint256;

	ERC20 public token;
	EscrowHolder public escrow;
	uint TOTAL_NUM_TOKENS = 500000000;

	function Bidding(address tokenAddress, address escrowAddress)
	public{
		require ( tokenAddress != address(0) && escrowAddress != address(0));
		token = ERC20(tokenAddress);
		escrow = EscrowHolder(escrowAddress);
	}


	/*    ----------------------------- BIDDING -----------------------------     */

	enum BiddingPhase {initialised, bidding, revealing, choosing, completed, cancelled}

	struct OfferDefinition{
		//Parameters of one escrow
		uint total_escrow_time;
		uint max_token_amount;
		uint min_stake_amount;

		//Parameters for the bidding
		uint reveal_start_time;
		uint choose_start_time;
		uint min_number_of_bids;

		//Parameters of the data
		uint data_size;
		uint replication_factor; //Number of DH's required


		//Parameters for use during the bidding mechanism
		uint256 number_of_bids;
		uint256 number_of_bids_revealed;
		uint total_bid_chance;
		uint random_number_seed;
		BiddingPhase bidding_phase;
	}

	struct BidDefinition{
		bytes32 bid_hash;
		address DH_wallet;
		uint node_id;
		uint token_amount;
		uint stake_amount;
		uint chance;
		bool active;
		bool chosen;
	}

	mapping(address => mapping(uint => OfferDefinition)) public offer;
	mapping(address => mapping(uint => mapping(uint => BidDefinition))) public bid;

	uint256 x;

	event OfferCreated(address DC_wallet, uint DC_node_id, uint data_id, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint data_size);
	event OfferCanceled(address DC_wallet, uint data_id);
	event RevealPhaseStarted(address DC_wallet, uint data_id);
	event ChoosingPhaseStarted(address DC_wallet, uint data_id);
	event AddedBid(address DC_wallet,uint data_id, uint bidIndex, address DH_wallet, uint node_id, bytes32 bid_hash);
	event BidTaken(address DC_wallet, address DH_wallet, uint data_id);
	event RevealedBid(address DC_wallet, address DH_wallet,  uint node_id,uint data_id,  uint token_amount, uint stake_amount);
	event OfferFinalized(address DC_wallet,uint data_id);
	event XwasSet(uint x);

	function createOffer(
		uint data_id,
		uint DC_node_id,
		uint total_escrow_time,
		uint max_token_amount,
		uint min_stake_amount,
		uint bidding_phase_time,
		uint min_number_of_bids,
		uint data_size,
		uint replication_factor)
	public returns (uint choose_start_time){

		require(max_token_amount > 0 && total_escrow_time > 0 && min_number_of_bids > 0 && bidding_phase_time > 0 && replication_factor > 0);
		require(replication_factor <= min_number_of_bids);

		// require(token.allowance(msg.sender,this) >= SafeMath.mul(tokens_per_DH,replication_factor));
		// token.transferFrom(msg.sender,this,SafeMath.mul(tokens_per_DH,replication_factor));

		offer[msg.sender][data_id].total_escrow_time = total_escrow_time;
		offer[msg.sender][data_id].max_token_amount = max_token_amount;
		offer[msg.sender][data_id].min_stake_amount = min_stake_amount;

		offer[msg.sender][data_id].reveal_start_time = block.timestamp + bidding_phase_time;
		choose_start_time = offer[msg.sender][data_id].choose_start_time = block.timestamp + 2 * bidding_phase_time;
		offer[msg.sender][data_id].min_number_of_bids = min_number_of_bids;

		offer[msg.sender][data_id].data_size = data_size;
		offer[msg.sender][data_id].replication_factor = replication_factor;

		offer[msg.sender][data_id].number_of_bids = 0;
		offer[msg.sender][data_id].number_of_bids_revealed = 0;
		offer[msg.sender][data_id].bidding_phase = BiddingPhase.bidding;
		OfferCreated(msg.sender, DC_node_id, data_id, total_escrow_time,max_token_amount, min_stake_amount, data_size);
	}


	//Da li vraca pare? Kada sme da uradi cancel?
	function cancelOffer(uint data_id)
	public{
		offer[msg.sender][data_id].bidding_phase = BiddingPhase.cancelled;
		OfferCanceled(msg.sender, data_id);
	}

	function isBidChosen(address DC_wallet, uint data_id, uint bidIndex) public constant returns (bool _isBidChosen){
		return bid[DC_wallet][data_id][bidIndex].chosen;
	}
	function getOfferStatus(address DC_wallet, uint data_id) public constant returns (BiddingPhase offerStatus){
		return offer[DC_wallet][data_id].bidding_phase;
	}

	function addBid(address DC_wallet, uint data_id, uint node_id, bytes32 bid_hash)
	public returns (uint bidIndex){
		// require(offer[DC_wallet][data_id].active);
		require(offer[DC_wallet][data_id].bidding_phase == BiddingPhase.bidding);
//		require(offer[DC_wallet][data_id].reveal_start_time > block.timestamp);

		bidIndex = offer[DC_wallet][data_id].number_of_bids;
		offer[DC_wallet][data_id].number_of_bids = offer[DC_wallet][data_id].number_of_bids.add(1);

		// fix
		bid[DC_wallet][data_id][bidIndex].bid_hash = bid_hash;

		// bid[DC_wallet][data_id][bidIndex].bid_hash = keccak256(msg.sender, node_id, token_amount, stake_amount);
		AddedBid(DC_wallet,data_id, bidIndex, msg.sender, node_id, bid_hash );

		if(offer[DC_wallet][data_id].number_of_bids >= offer[DC_wallet][data_id].replication_factor){
			offer[DC_wallet][data_id].bidding_phase = BiddingPhase.revealing;
			RevealPhaseStarted(DC_wallet,data_id);
		}
		return bidIndex;
	}

	function revealBid(address DC_wallet, uint data_id, uint node_id, uint token_amount, uint stake_amount, uint bidIndex)
	public {

		require(offer[DC_wallet][data_id].bidding_phase == BiddingPhase.revealing);
//		require(offer[DC_wallet][data_id].choose_start_time > block.timestamp);
		require(offer[DC_wallet][data_id].max_token_amount >= token_amount);

		require(bid[DC_wallet][data_id][bidIndex].bid_hash == keccak256(msg.sender, node_id, token_amount, stake_amount));

		bid[DC_wallet][data_id][bidIndex].DH_wallet = msg.sender;
		bid[DC_wallet][data_id][bidIndex].node_id = node_id;
		bid[DC_wallet][data_id][bidIndex].token_amount = token_amount;
		bid[DC_wallet][data_id][bidIndex].stake_amount = stake_amount;
		bid[DC_wallet][data_id][bidIndex].chance = TOTAL_NUM_TOKENS / token_amount;

		OfferDefinition storage this_offer = offer[DC_wallet][data_id];

		this_offer.total_bid_chance = this_offer.total_bid_chance.add(TOTAL_NUM_TOKENS / token_amount);
		this_offer.number_of_bids_revealed = this_offer.number_of_bids_revealed.add(1);
		this_offer.random_number_seed = this_offer.random_number_seed + block.number;//FIX

		RevealedBid(DC_wallet,msg.sender, node_id,data_id, token_amount, stake_amount);

		if(this_offer.number_of_bids_revealed >= this_offer.number_of_bids){
			this_offer.bidding_phase = BiddingPhase.choosing;
			ChoosingPhaseStarted(DC_wallet,data_id);
		}

	}

	function cancelBid(address DC_wallet, uint data_id, uint bidIndex)
	public{
		require(bid[DC_wallet][data_id][bidIndex].DH_wallet == msg.sender);
		require(bid[DC_wallet][data_id][bidIndex].active);

		offer[DC_wallet][data_id].total_bid_chance = offer[DC_wallet][data_id].total_bid_chance.sub(bid[DC_wallet][data_id][bidIndex].chance);
		offer[DC_wallet][data_id].number_of_bids_revealed = offer[DC_wallet][data_id].number_of_bids_revealed.sub(1);

		bid[DC_wallet][data_id][bidIndex].chance = 0;
		bid[DC_wallet][data_id][bidIndex].active = false;
	}

	function chooseBids(uint data_id) public returns (uint256[] chosen_data_holders){

		OfferDefinition storage this_offer = offer[msg.sender][data_id];

		require(this_offer.min_number_of_bids <= this_offer.number_of_bids_revealed);
//		require(this_offer.choose_start_time <= block.timestamp);//

		require(this_offer.bidding_phase == BiddingPhase.choosing);

		uint N = this_offer.replication_factor;
		chosen_data_holders = new uint256[](N);

		uint256 i = 0;
		uint256 seed = this_offer.random_number_seed;

		while(i < N && N <= this_offer.number_of_bids_revealed){	//FIX: Should be hash(block.hash)

			uint nextIndex = (seed * this_offer.number_of_bids + block.timestamp) % this_offer.total_bid_chance;
			uint256 j = 0;
			uint256 sum = bid[msg.sender][data_id][j].chance;
			while(sum < nextIndex){
				j++;
				sum = sum.add(bid[msg.sender][data_id][j].chance);
			}
			BidDefinition storage chosenBid = bid[msg.sender][data_id][j];
			if(token.allowance(chosenBid.DH_wallet,this) >= chosenBid.stake_amount
			&& token.balanceOf(chosenBid.DH_wallet) >= chosenBid.stake_amount){

				uint stake_to_transfer = chosenBid.stake_amount;
				chosenBid.stake_amount = 0;
				chosenBid.chance = 0;
				// // transfering stake
				// if(stake_to_transfer > 0) token.transferFrom(chosenBid.DH_wallet,escrow,stake_to_transfer);    

				//Initiating new escrow
				escrow.initiateEscrow(msg.sender, chosenBid.DH_wallet, data_id, chosenBid.token_amount, stake_to_transfer, this_offer.total_escrow_time);
				//TODO Ako DC odmah salje pare ovde racunati koliko treba da mu se vrati
				chosenBid.chosen = true;
				chosen_data_holders[i] = j;
				i++;
				BidTaken(msg.sender, chosenBid.DH_wallet, data_id);
			}
			else{
				this_offer.number_of_bids_revealed = this_offer.number_of_bids_revealed.sub(1);
				chosenBid.chance = 0;
				chosenBid.active = false;

			}
			chosenBid.chance = 0;
			this_offer.total_bid_chance = this_offer.total_bid_chance.sub(chosenBid.chance);
		}



		offer[msg.sender][data_id].bidding_phase = BiddingPhase.completed;
		OfferFinalized(msg.sender,data_id);

	}

}