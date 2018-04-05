var TestUtils = artifacts.require("./TestingUtilities.sol");
var TracToken = artifacts.require("./TracToken.sol");
var EscrowHolder = artifacts.require("./EscrowHolder.sol");

var Web3 = require('web3');

//Constant values
let escrowDuration = 20;
const one_ether = "1000000000000000000";
var DC_wallet;
var DH_wallet;
const data_id = 20;
var escrow_address;

contract('Escrow testing', async (accounts) =>{

  it("Should get TracToken contract", async () => {
    await TracToken.deployed();
    });
  it("Should get Escrow contract", async () => {
    await EscrowHolder.deployed();
    });

  it("Should wait for the escrow to be deployed", async() => {
    await new Promise((resolve) => setTimeout(resolve,1000));
    });

  it("Should get the escrow_address", async () => {
    await EscrowHolder.deployed().then( res => {
      escrow_address = res.address;
      }).catch(err => console.log(err));
    console.log("\t Escrow address: " + escrow_address);
  });
  
  DC_wallet = accounts[1];
  DH_wallet = accounts[2];

  it("Should mint 2 G tokens ", async () =>{
    let trace = await TracToken.deployed();
    let amount = "2000000000";
    await trace.mint(DC_wallet, "1000000000", {from:accounts[0]});
    await trace.mint(DH_wallet, "1000000000", {from:accounts[0]});

    await trace.endMinting({from:accounts[0]});

    let response = await trace.balanceOf.call(accounts[1]);
    let balance_DC = response.toNumber();
    console.log("\t balance_DC: " + balance_DC);
    response = await trace.balanceOf.call(accounts[2]);
    let balance_DH = response.toNumber();
    console.log("\t balance_DH: " + balance_DH);

    assert.equal(balance_DC, 1000000000, "DC balance not 1 billion");
    assert.equal(balance_DH, 1000000000, "DH balance not 1 billion");
    });



  it("Should increase allowance for DC to 1000000000", async () => {
    let instance = await EscrowHolder.deployed();
    let trace = await TracToken.deployed();

    let response = await trace.allowance.call(DC_wallet, instance.address);
    let allowance_DC = response.toNumber();
    console.log("\t allowance_DC: " + allowance_DC);
    

    await trace.increaseApproval(instance.address, 100000000, {from: DC_wallet});

    response = await trace.allowance.call(DC_wallet, instance.address);
    allowance_DC = response.toNumber();
    console.log("\t allowance_DC: " + allowance_DC);

    assert.equal(allowance_DC, 100000000, "The proper amount was not allowed");
    });

  it("Should create an Escrow, lasting 20 blocks, valued 100000000 trace", async () => {
    let instance = await EscrowHolder.deployed();
    let util = await TestUtils.deployed();

    let response = await util.getBlockNumber.call();

    await instance.initiateEscrow(DH_wallet, data_id, 100000000, escrowDuration, {from: DC_wallet}).then(function(result) {
      console.log("\t Initiate escrow - Gas used : " + result.receipt.gasUsed);
      });

    response = await instance.escrow.call(DC_wallet, DH_wallet, data_id);


    let token_amount = response[0];
    token_amount = token_amount.toNumber();

    let tokens_sent = response[1];
    tokens_sent = tokens_sent.toNumber();

    let actual_startTime = response[2];
    actual_startTime = actual_startTime.toNumber();

    let endTime = response[3];
    endTime = endTime.toNumber();

    let total_time = response[4];;
    total_time = total_time.toNumber();

    let status = response[5];
    status = status.toNumber();
    switch(status){
      case 0: 
      status = "initated";
      break;
      case 1: 
      status = "verified";
      break;
      case 2: 
      status = "canceled";
      break;
      case 3: 
      status = "completed";
      break;
      default: 
      status = "err";
      break;
    };

    console.log('Escrow values: ');
    console.log('\t token_amount: ' + token_amount);
    console.log('\t tokens_sent: ' + tokens_sent);
    console.log('\t start_time: ' + actual_startTime);
    console.log('\t end_time: ' + endTime);
    console.log('\t total_time: ' + total_time);
    console.log('\t status: ' + status);


    assert.equal(token_amount, 100000000, "Amount of tokens does not match!");
    assert.equal(tokens_sent, 0, "Sent tokens not equal zero!");
    assert.equal(stake, 100000000, "Stake amount does not match!");
    assert.equal(0, actual_startTime,"Start time not equal zero!");
    assert.equal(0, endTime, "End time not equal zero!");
    assert.equal(escrowDuration, total_time, "Escrow duration does not match!");
    assert.equal(status, 'initated', "Escrow status not initated properly!");
    });

  it("Should break - DH verifies escrow with wrong token amount", async () => {
    let instance = await EscrowHolder.deployed();

    let error;
    try{
      await instance.verify(DC_wallet, data_id, 3 * 100000000, escrowDuration, {from: DH_wallet}).then(function(result) {
      console.log("\t Verify escrow - Gas used : " + result.receipt.gasUsed);
      });
    }
    catch(e){
      error = e;
    }

    assert.notEqual(error, undefined, 'Error must be thrown');
    assert.isAbove(error.message.search('invalid opcode'), -1, 'invalid opcode error must be returned');

    });



  it("Should verify an existing escrow", async () => {
    let instance = await EscrowHolder.deployed();

    await instance.verify(DC_wallet, data_id, 100000000, escrowDuration, {from: DH_wallet}).then(function(result) {
      console.log("\t Verify escrow - Gas used : " + result.receipt.gasUsed);
      });

    response = await instance.escrow.call(DC_wallet, DH_wallet, data_id);
    let status = response[5];
    status = status.toNumber();
    switch(status){
      case 0: 
      status = "initated";
      break;
      case 1: 
      status = "verified";
      break;
      case 2: 
      status = "canceled";
      break;
      case 3: 
      status = "completed";
      break;
      default: 
      status = "err";
      break;
    };

    console.log('\t Status: ' + status);
    assert.equal(status, 'verified',"Escrow wasn't verified");

    });

  });