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

		uint next_bid;

		bool canceled;
		bool chosen;
	}

	struct BidList{
		uint first;
		BidListElem[] list;
	}

	mapping(address => mapping(uint => BidList)) public bids;
	mapping(address => mapping(uint => OfferDefinition)) public offer; //offer[DC_address][nonce/import_id/...]
	mapping(address => mapping(uint => DHProfileDefinition)) public DH_profile; //DH_profile[DH_address][DH_node_id]

	event OfferCreated(address DC_wallet,uint DC_node_id, uint data_id, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint data_size);
	event OfferCanceled(address DC_wallet, uint data_id)
	event AddedBid(address DC_wallet,uint data_id, uint bidIndex, address DH_wallet, uint node_id, bytes32 bid_hash);
	event BidTaken(address DC_wallet, address DH_wallet, uint data_id);
	event OfferFinalized(address DC_wallet,uint data_id);

	/*    ----------------------------- OFFERS -----------------------------     */

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

		uint data_size)
	public returns (bool offerCreated){

		require(max_token_amount > 0 && total_escrow_time > 0 && min_number_of_bids > 0 > 0 && replication_factor > 0);
		require(replication_factor <= required_number_of_bids);
		require(offer[msg.sender][data_id].active == false);

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
		OfferCreated(msg.sender, DC_node_id, data_id, total_escrow_time, max_token_amount, min_stake_amount, min_reputation, data_size, data_hash);
	}

	//TODO Decide when and under which conditions DC can cancel an offer
	function cancelOffer(uint DC_node_id, uint data_id)
	public{
		offer[msg.sender][DC_node_id][data_id].active = false;
		OfferCanceled(msg.sender, DC_node_id, data_id);
	}

	function addBid(address DC_wallet, uint data_id, uint DH_node_id)
	public returns (uint bidIndex){
		require(offer[DC_wallet][data_id].active);

		OfferDefinition this_offer = offer[DC_wallet][data_id];
		DHProfileDefinition this_DH = DH_profile[msg.sender][DH_node_id];

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size * this_offer.total_escrow_time;
		require(this_offer.total_escrow_time <= DH_profile.max_escrow_time);
		require(this_offer.max_token_amount  >= DH_profile.token_amount * scope);
		require(this_offer.min_stake_amount  <= DH_profile.stake_amount * scope);
		require(this_offer.min_reputation 	 <= DH_profile.reputation);
		require(this_offer.data_size		 <= DH_profile.size_available);

		//Insert the bid into the list
		BidListElem new_list_elem = BidListElem(msg.sender, DH_node_id, 0, false, false);
		bid[DC_wallet][data_id].list.push(new_list_elem);
		BidListElem current = bid[DC_wallet][data_id].list[bid[DC_wallet][data_id].first];


		bidIndex = offer[DC_wallet][data_id].number_of_bids;	
		offer[DC_wallet][data_id].number_of_bids = offer[DC_wallet][data_id].number_of_bids.add(1);


		
		// bid[DC_wallet][data_id][bidIndex].bid_hash = keccak256(msg.sender, node_id, token_amount, stake_amount);
		AddedBid(DC_wallet,data_id, bidIndex, msg.sender, node_id, bid_hash );
		return bidIndex;
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
		require(this_offer.choose_start_time <= block.timestamp);

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



		offer[msg.sender][data_id].finalized = true;
		OfferFinalized(msg.sender,data_id);

	}


	function isBidChosen(address DC_wallet, uint data_id, uint bidIndex) public constant returns (bool _isBidChosen){
		return bid[DC_wallet][data_id][bidIndex].chosen;
	}

	function getOfferStatus(address DC_wallet, uint data_id) public constant returns (bool isOfferFinal){
		return offer[DC_wallet][data_id].finalized;
	}

}