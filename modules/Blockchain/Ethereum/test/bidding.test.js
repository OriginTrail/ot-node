const { assert, expect } = require('chai');

var TestingUtilities = artifacts.require('./TestingUtilities.sol'); // eslint-disable-line no-undef
var TracToken = artifacts.require('./TracToken.sol'); // eslint-disable-line no-undef
var EscrowHolder = artifacts.require('./EscrowHolder.sol'); // eslint-disable-line no-undef
var Bidding = artifacts.require('./BiddingTest.sol'); // eslint-disable-line no-undef
var Reading = artifacts.require('./Reading.sol'); // eslint-disable-line no-undef

var Web3 = require('web3');

// Global values
var DC_wallet;
const amount_to_mint = 5e25;

// Offer variables
var import_id = 0;
const data_size = 1;
const total_escrow_time = 1;
const max_token_amount = 1000e18;
const min_stake_amount = 10e12;
const min_reputation = 0;
const predestined_first_bid_index = 9;

// Profile variables
var chosen_bids = [];
var node_id = [];
var DH_balance = [];
var DH_credit = [];
var DH_price = [];
var DH_stake = [];
var DH_read_factor = [];

// eslint-disable-next-line no-undef
contract('Bidding testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    it('Should get TracToken contract', async () => {
        await TracToken.deployed().then((res) => {
            console.log(`\t TracToken address: ${res.address}`);
        }).catch(err => console.log(err));
    });

    // eslint-disable-next-line no-undef
    it('Should get Escrow contract', async () => {
        await EscrowHolder.deployed().then((res) => {
            console.log(`\t Escrow address: ${res.address}`);
        }).catch(err => console.log(err));
    });

    // eslint-disable-next-line no-undef
    it('Should get Bidding contract', async () => {
        await Bidding.deployed().then((res) => {
            console.log(`\t Bidding address: ${res.address}`);
        }).catch(err => console.log(err));
    });

    // eslint-disable-next-line no-undef
    it('Should get Reading contract', async () => {
        await Reading.deployed().then((res) => {
            console.log(`\t Reading address: ${res.address}`);
        }).catch(err => console.log(err));
    });

    // eslint-disable-next-line no-undef
    it('Should get TestingUtilities contract', async () => {
        await TestingUtilities.deployed().then((res) => {
            console.log(`\t TestingUtilities address: ${res.address}`);
        }).catch(err => console.log(err));
    });

    DC_wallet = accounts[0]; // eslint-disable-line prefer-destructuring

    // eslint-disable-next-line no-undef
    it('Should make node_id for every profile (as keccak256(wallet_address))', async () => {
        // Get instances of contracts used in the test
        const util = await TestingUtilities.deployed();

        for (var i = 0; i < 10; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const response = await util.keccakSender.call({ from: accounts[i] });
            node_id.push(response);
        }
    });

    // createProfile(bytes32 node_id, uint price, uint stake, uint max_time, uint max_size)
    // 0: uint256: token_amount
    // 1: uint256: stake_amount
    // 2: uint256: read_stake_factor
    // 3: uint256: balance
    // 4: uint256: reputation
    // 5: uint256: max_escrow_time
    // 6: uint256: size_available
    // eslint-disable-next-line no-undef
    it('Should create 10 profiles', async () => {
        // Get instances of contracts used in the test
        const bidding = await Bidding.deployed();

        var promises = [];
        for (var i = 0; i < 10; i += 1) {
            // console.log(`\t Creating profile ${node_id[i]}`);
            DH_balance[i] = 5e25;
            DH_price[i] = Math.round(Math.random() * 1000) * 1e15;
            DH_stake[i] = (Math.round(Math.random() * 1000) + 10) * 1e15;
            DH_read_factor[i] = (Math.round(Math.random() * 5));
            promises[i] = bidding.createProfile(
                node_id[i],
                DH_price[i],
                DH_stake[i],
                DH_read_factor[i],
                1000,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        for (i = 0; i < DH_price.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            var response = await bidding.profile.call(accounts[i]);

            console.log(`\t account[${i}] price: ${response[0].toNumber() / 1e18} \t stake: ${response[1].toNumber() / 1e18}`);

            assert.equal(response[0].toNumber(), DH_price[i], 'Price not matching');
            assert.equal(response[1].toNumber(), DH_stake[i], 'Stake not matching');
        }
    });

    // eslint-disable-next-line no-undef
    it('Should increase node-bidding approval before depositing', async () => {
        // Get instances of contracts used in the test
        const token = await TracToken.deployed();
        const bidding = await Bidding.deployed();

        var promises = [];
        for (var i = 0; i < 10; i += 1) {
            promises[i] = token.increaseApproval(
                bidding.address, DH_balance[i],
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        for (i = 0; i < DH_balance.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            var allowance = await token.allowance.call(accounts[i], bidding.address);
            allowance = allowance.toNumber();
            assert.equal(allowance, DH_balance[i], 'The proper amount was not allowed');
        }
    });

    // eslint-disable-next-line no-undef
    it('Should deposit tokens from every node to bidding', async () => {
        // Get instances of contracts used in the test
        const bidding = await Bidding.deployed();

        var promises = [];
        for (var i = 0; i < 10; i += 1) {
            promises[i] = bidding.depositToken(DH_balance[i], { from: accounts[i] });
        }
        await Promise.all(promises);


        for (i = 0; i < DH_balance.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            var response = await bidding.profile.call(accounts[i]);
            var actual_balance = response[3].toNumber();
            assert.equal(actual_balance, DH_balance[i], 'The proper amount was not deposited');
            DH_balance[i] = 0;
            DH_credit[i] = actual_balance;
        }
    });

    // eslint-disable-next-line no-undef
    it('Should create escrow offer, with acc[1] and [2] as predetermined', async () => {
        // Get instances of contracts used in the test
        const bidding = await Bidding.deployed();
        const util = await TestingUtilities.deployed();

        const predetermined_wallet = [];
        predetermined_wallet.push(accounts[1]);
        predetermined_wallet.push(accounts[2]);
        const predetermined_node_id = [];
        predetermined_node_id.push(node_id[1]);
        predetermined_node_id.push(node_id[2]);

        // Data holding parameters
        const data_hash = await util.keccakSender({ from: accounts[predestined_first_bid_index] });

        console.log(`\t Data hash: ${data_hash}`);

        await bidding.createOffer(
            import_id,
            node_id[0],

            total_escrow_time,
            max_token_amount,
            min_stake_amount,
            min_reputation,

            data_hash,
            data_size,

            predetermined_wallet,
            predetermined_node_id,
            { from: DC_wallet },
        );

        const response = await bidding.offer.call(import_id);

        const actual_DC_wallet = response[0];

        console.log(`\t DC_wallet: ${actual_DC_wallet}`);

        let actual_max_token = response[1];
        actual_max_token = actual_max_token.toNumber();
        console.log(`\t actual_max_token: ${actual_max_token}`);

        let actual_min_stake = response[2];
        actual_min_stake = actual_min_stake.toNumber();
        console.log(`\t actual_min_stake: ${actual_min_stake}`);

        let actual_min_reputation = response[3];
        actual_min_reputation = actual_min_reputation.toNumber();
        console.log(`\t actual_min_reputation: ${actual_min_reputation}`);

        let actual_escrow_time = response[4];
        actual_escrow_time = actual_escrow_time.toNumber();
        console.log(`\t actual_escrow_time: ${actual_escrow_time}`);

        let actual_data_size = response[5];
        actual_data_size = actual_data_size.toNumber();
        console.log(`\t actual_data_size: ${actual_data_size}`);

        let replication_factor = response[8];
        replication_factor = replication_factor.toNumber();
        console.log(`\t replication_factor: ${replication_factor}`);

        assert.equal(actual_DC_wallet, DC_wallet, 'DC_wallet not matching');
        assert.equal(actual_max_token, max_token_amount, 'max_token_amount not matching');
        assert.equal(actual_min_stake, min_stake_amount, 'min_stake_amount not matching');
        assert.equal(actual_min_reputation, min_reputation, 'min_reputation not matching');
        assert.equal(actual_data_size, data_size, 'data_size not matching');
        assert.equal(actual_escrow_time, total_escrow_time, 'total_escrow_time not matching');
        assert.equal(replication_factor, predetermined_wallet.length, 'replication_factor not matching');
    });

    // eslint-disable-next-line no-undef
    it('Should get a bid index of accounts[2]', async () => {
        // Get instances of contracts used in the test
        const bidding = await Bidding.deployed();

        var actual_index =
        await bidding.getBidIndex(import_id, node_id[2], { from: accounts[2] });
        actual_index = actual_index.toNumber();

        assert.equal(actual_index, 1, 'Bid index not equal 1');
    });

    // eslint-disable-next-line no-undef
    it('Should activate predetermined bid for acc[2]', async () => {
        // Get instances of contracts used in the test
        const bidding = await Bidding.deployed();

        await bidding.activatePredeterminedBid(import_id, node_id[2], 1, { from: accounts[2] });
    });

    // eslint-disable-next-line no-undef
    it('Should add 7 more bids', async () => {
        // Get instances of contracts used in the test
        const bidding = await Bidding.deployed();

        for (var i = 3; i < 10; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            var response = await bidding.addBid.call(import_id, node_id[i], { from: accounts[i] });
            console.log(`\t distance[${i}] = ${response.toNumber()}`);
        }

        var first_bid_index;
        for (i = 3; i < 10; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await bidding.addBid(import_id, node_id[i], { from: accounts[i] });
            // eslint-disable-next-line no-await-in-loop
            response = await bidding.offer.call(import_id);
            first_bid_index = response[7].toNumber();
            console.log(`\t first_bid_index =  ${first_bid_index} (node[${first_bid_index + 1}])`);
        }

        assert.equal(first_bid_index, predestined_first_bid_index - 1, 'Something wrong');
    });

    // EscrowDefinition
    // 0: uint token_amount
    // 1: uint tokens_sent
    // 2: uint stake_amount
    // 3: uint last_confirmation_time
    // 4: uint end_time
    // 5: uint total_time

    // eslint-disable-next-line no-undef
    it('Should choose bids', async () => {
        // Get instances of contracts used in the test
        const bidding = await Bidding.deployed();
        const escrow = await EscrowHolder.deployed();

        chosen_bids = await bidding.chooseBids.call(import_id, { from: DC_wallet });
        console.log(`\t chosen DH indexes: ${JSON.stringify(chosen_bids)}`);

        for (var i = 0; i < chosen_bids.length; i += 1) {
            chosen_bids[i] = chosen_bids[i].toNumber() + 1;
        }

        await bidding.chooseBids(import_id);
    });

    // Merkle tree structure
    /*      / \
           /   \
          /     \
         /       \
        /         \
       / \       / \
      /   \     /   \
     /\   /\   /\   /\
    A  B C  D E  F G  H
    */
    var requested_data_index = 5;
    var requested_data = [];
    var hashes = [];
    var hash_AB;
    var hash_CD;
    var hash_EF;
    var hash_GH;
    var hash_ABCD;
    var hash_EFGH;
    var root_hash;

    const checksum = 0;

    // eslint-disable-next-line no-undef
    it('Should calculate and add all root hashes and checksums', async () => {
        // Get instances of contracts used in the test
        const escrow = await EscrowHolder.deployed();
        const util = await TestingUtilities.deployed();

        // Creating merkle tree
        for (var i = 0; i < 8; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            requested_data[i] = await util.keccakString.call('A');
            // eslint-disable-next-line no-await-in-loop
            hashes[i] = await util.keccakIndex.call(requested_data[i], i);
        }
        hash_AB = await util.keccak2hashes.call(hashes[0], hashes[1]);
        hash_CD = await util.keccak2hashes.call(hashes[2], hashes[3]);
        hash_EF = await util.keccak2hashes.call(hashes[4], hashes[5]);
        hash_GH = await util.keccak2hashes.call(hashes[6], hashes[7]);
        hash_ABCD = await util.keccak2hashes.call(hash_AB, hash_CD);
        hash_EFGH = await util.keccak2hashes.call(hash_EF, hash_GH);
        root_hash = await util.keccak2hashes.call(hash_ABCD, hash_EFGH);

        var promises = [];
        for (i = 0; i < chosen_bids.length; i += 1) {
            promises[i] = escrow.addRootHashAndChecksum(
                import_id,
                root_hash,
                root_hash,
                checksum,
                { from: accounts[chosen_bids[i]] },
            );
        }
        await Promise.all(promises);

        for (i = 0; i < chosen_bids.length; i += 1) {
            // eslint-disable-next-line
            var response = await escrow.escrow.call(import_id, accounts[chosen_bids[i]]);
            console.log(`\t escrow for profile ${chosen_bids[i]}: ${JSON.stringify(response)}`);
        }
    });

    // eslint-disable-next-line no-undef
    it('Should verify all escrows', async () => {
        // Get instances of contracts used in the test
        const escrow = await EscrowHolder.deployed();
        const util = await TestingUtilities.deployed();

        var promises = [];
        for (var i = 0; i < chosen_bids.length; i += 1) {
            promises[i] = escrow.verifyEscrow(
                import_id,
                accounts[chosen_bids[i]],
                { from: DC_wallet },
            );
        }
        await Promise.all(promises);

        // Get block timestamp
        var response = await util.getBlockTimestamp.call();
        response = response.toNumber();
        console.log(`\t Escrow start time: ${response}, Escrow end time: ${response + (60 * total_escrow_time)}`);

        for (i = 1; i < 10; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            response = await escrow.escrow.call(import_id, accounts[i]);
            let status = response[10];
            status = status.toNumber();
            switch (status) {
            case 0:
                status = 'inactive';
                break;
            case 1:
                status = 'initiated';
                break;
            case 2:
                status = 'confirmed';
                break;
            case 3:
                status = 'active';
                break;
            case 4:
                status = 'completed';
                break;
            default:
                status = 'err';
                break;
            }
            console.log(`\t EscrowStatus for account[${i}]: ${status}`);
            if (chosen_bids.includes(i)) {
                assert.equal(status, 'active', "Escrow wasn't verified");
            }
        }
    });

    var litigators = [];

    // eslint-disable-next-line no-undef
    it('Should create 2 litigations about data no 6', async () => {
        // Get instances of contracts used in the test
        const escrow = await EscrowHolder.deployed();

        // TODO Find a way not to hard code this test
        requested_data_index = 5;
        var hash_array = [];
        hash_array.push(hashes[4]);
        hash_array.push(hash_GH);
        hash_array.push(hash_ABCD);

        litigators.push(chosen_bids[0]);
        litigators.push(chosen_bids[1]);

        await escrow.initiateLitigation(
            import_id,
            accounts[litigators[0]],
            requested_data_index,
            hash_array,
            { from: DC_wallet },
        );
        await escrow.initiateLitigation(
            import_id,
            accounts[litigators[1]],
            requested_data_index,
            hash_array,
            { from: DC_wallet },
        );
    });

    // eslint-disable-next-line no-undef
    it('Should answer litigations, one correctly, one incorrectly', async () => {
        // Get instances of contracts used in the test
        const escrow = await EscrowHolder.deployed();

        await escrow.answerLitigation(
            import_id,
            requested_data[requested_data_index],
            { from: accounts[litigators[0]] },
        );
        await escrow.answerLitigation(
            import_id,
            '',
            { from: accounts[litigators[1]] },
        );

        for (var i = 0; i < litigators.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            var response = await escrow.litigation.call(import_id, accounts[litigators[i]]);
            console.log(`\t litigation for profile ${litigators[i]}: ${JSON.stringify(response)}`);
        }
    });


    // eslint-disable-next-line no-undef
    it('Should prove litigations, both correctly', async () => {
        // Get instances of contracts used in the test
        const escrow = await EscrowHolder.deployed();
        const util = await TestingUtilities.deployed();

        var promises = [];
        for (var i = 0; i < litigators.length; i += 1) {
            promises[i] = escrow.proveLitigaiton(
                import_id,
                accounts[litigators[i]],
                requested_data[requested_data_index],
                { from: DC_wallet },
            );
        }
        await Promise.all(promises);

        for (i = 0; i < litigators.length; i += 1) {
            // eslint-disable-next-line
            var response = await escrow.litigation.call(import_id, accounts[litigators[i]]);
            console.log(`\t litigation for profile ${chosen_bids[i]}: ${JSON.stringify(response)}`);
        }
    });


    // eslint-disable-next-line no-undef
    it('Should wait a 30 seconds, then pay all DHs', async () => {
        // Get instances of contracts used in the test
        const escrow = await EscrowHolder.deployed();
        const bidding = await Bidding.deployed();
        const util = await TestingUtilities.deployed();

        await new Promise(resolve => setTimeout(resolve, 30000));

        var response = await util.getBlockTimestamp.call();
        response = response.toNumber();
        console.log(`\t current escrow time: ${response}`);

        var promises = [];
        for (var i = 0; i < chosen_bids.length; i += 1) {
            if (chosen_bids[i] !== litigators[1]) {
                promises[i] = escrow.payOut(
                    import_id,
                    { from: accounts[chosen_bids[i]], gas: 1000000 },
                );
            }
        }
        await Promise.all(promises);

        for (i = 0; i < chosen_bids.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            response = await bidding.profile.call(accounts[chosen_bids[i]]);
            var balance = response[2].toNumber();
            // console.log(`\t new DH balance[${chosen_bids[i]}]: ${balance}`);
        }
    });

    // eslint-disable-next-line no-undef
    it('Should wait another 30 seconds, then pay out all DH_s', async () => {
        // Get instances of contracts used in the test
        const escrow = await EscrowHolder.deployed();
        const bidding = await Bidding.deployed();
        const util = await TestingUtilities.deployed();

        // Await for 35 seconds, just to be on the safe side
        await new Promise(resolve => setTimeout(resolve, 40000));

        var response = await util.getBlockTimestamp.call();
        response = response.toNumber();
        console.log(`\t Escrow finish time: ${response}`);

        var promises = [];
        for (var i = 0; i < chosen_bids.length; i += 1) {
            if (chosen_bids[i] !== litigators[1]) {
                promises[i] = escrow.payOut(
                    import_id,
                    { from: accounts[chosen_bids[i]], gas: 1000000 },
                );
            }
        }
        await Promise.all(promises);

        for (i = 0; i < chosen_bids.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            response = await bidding.profile.call(accounts[chosen_bids[i]]);
            var balance = response[2].toNumber();
            console.log(`\t new DH balance[${chosen_bids[i]}]: ${balance}`);
            // TODO Fix the rounding of the token amount issue
            // assert.equal(
            //     balance,
            // eslint-disable-next-line max-len
            //     5e25 + (Math.round((DH_price[chosen_bids[i]]
            // * total_escrow_time * data_size) / 1e15) * 1e15),
            //     'DH was not paid the correct amount',
            // );
        }

        for (i = 0; i < chosen_bids.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            response = await escrow.escrow.call(import_id, accounts[chosen_bids[i]]);
            let status = response[10];
            status = status.toNumber();
            switch (status) {
            case 0:
                status = 'inactive';
                break;
            case 1:
                status = 'initiated';
                break;
            case 2:
                status = 'confirmed';
                break;
            case 3:
                status = 'active';
                break;
            case 4:
                status = 'completed';
                break;
            default:
                status = 'err';
                break;
            }
            console.log(`\t EscrowStatus for account[${chosen_bids[i]}]: ${status}`);
            assert.equal(status, 'completed', "Escrow wasn't completed");
        }
        for (i = 0; i < chosen_bids.length; i += 1) {
            // eslint-disable-next-line
            var response = await escrow.escrow.call(import_id, accounts[chosen_bids[i]]);
            console.log(`\t escrow for profile ${chosen_bids[i]}: ${JSON.stringify(response)}`);
        }
    });

    var read_token_amount = 10e10;

    // eslint-disable-next-line no-undef
    it('Should initiate reading between acc[2] and acc[1]', async () => {
        // Get instances of contracts used in the test
        const reading = await Reading.deployed();

        const read_stake_factor = DH_read_factor[chosen_bids[0]];


        var response = await reading.purchased_data.call(import_id, accounts[chosen_bids[0]]);
        console.log(`${JSON.stringify(response)}`);

        var actual_DC_wallet = response[0];
        var actual_distribution_root_hash = response[1];
        var actual_checksum = response[2];

        assert.equal(actual_DC_wallet, DC_wallet, 'Purchased data - DC wallet not matching');
        assert.equal(
            actual_distribution_root_hash,
            root_hash,
            'Purchased data - distribution root hash not matching',
        );
        assert.equal(
            actual_checksum,
            checksum,
            'Purchased data - checksum not matching',
        );

        await reading.initiatePurchase(
            import_id,
            accounts[chosen_bids[0]],
            read_token_amount,
            { from: accounts[2] },
        );

        response = await reading.purchase.call(accounts[chosen_bids[0]], accounts[2], import_id);
        var actual_token_amount = response[0].toNumber();
        var actual_stake_factor = response[1].toNumber();
        var actual_status = response[5].toNumber();

        assert.equal(
            actual_token_amount,
            read_token_amount,
            'Read token amount not matching',
        );
        assert.equal(
            actual_stake_factor,
            read_stake_factor,
            'Read stake factor not matching',
        );
        assert.equal(
            actual_status,
            1,
            'Read status not initiated',
        );
    });
});
