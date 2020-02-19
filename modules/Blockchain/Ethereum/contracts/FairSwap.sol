pragma solidity ^0.4.0;

contract FairSwap {

    uint constant depth = XXXDEPTHXXX;
    uint constant length = XXXLENGTHXXX;
    uint constant n = XXXNXXX;



    enum stage {created, initialized, accepted, keyRevealed, finished}
    stage public phase = stage.created;
    uint public timeout;

    address public sender; //XXXAddressSXXX;
    address public receiver = XXXAddressRXXX;
    uint price = 100; //XXXPriceAXXX; // in wei

    bytes32 public keyCommit = XXXcommitmentXXX;
    bytes32 public chiphertextRoot = XXXrZXXX;
    bytes32 public fileRoot = XXXfileRootXXX;

    bytes32 public key;

    // function modifier to only allow calling the function in the right phase only from the correct party
    modifier allowed(address p, stage s) {
        require(phase == s);
        require(now < timeout);
        require(msg.sender == p);
        _;
    }

    // go to next phase
    function nextStage() internal {
        phase = stage(uint(phase) + 1);
        timeout = now + 10 minutes;
    }

    // constructor is initialize function
    constructor () public {

        sender = msg.sender;
        nextStage();
    }

    // function accept
    function accept () allowed(receiver, stage.initialized) payable public {

        require (msg.value >= price);
        nextStage();
    }

    // function revealKey (key)
    function revealKey (bytes32 _key) allowed(sender, stage.accepted) public {

        require(keyCommit == keccak256(_key));
        key = _key;
        nextStage();
    }


    // function complain about wrong hash of file
    function noComplain () allowed(receiver, stage.keyRevealed) public {

        selfdestruct(sender);
    }

    // function complain about wrong hash of file
    function complainAboutRoot (bytes32 _Zm, bytes32[depth] _proofZm) allowed( receiver, stage.keyRevealed) public {

        require (vrfy(2*(n-1), _Zm, _proofZm));
        if (cryptSmall(2*(n-1), _Zm) != fileRoot){
            selfdestruct(receiver);
        }
    }


    // function complain about wrong hash of two inputs
    function complainAboutLeaf (uint _indexOut, uint _indexIn,
        bytes32 _Zout, bytes32[length] _Zin1, bytes32[length] _Zin2, bytes32[depth] _proofZout,
        bytes32[depth] _proofZin) allowed( receiver, stage.keyRevealed) public {

        require (vrfy(_indexOut, _Zout, _proofZout));
        bytes32 Xout = cryptSmall(_indexOut, _Zout);

        require (vrfy(_indexIn, keccak256(_Zin1), _proofZin));
        require (_proofZin[0] == keccak256(_Zin2));

        if (Xout != keccak256(cryptLarge(_indexIn, _Zin1), cryptLarge(_indexIn+1, _Zin2))) {
            selfdestruct(receiver);
        }
    }


    // function complain about wrong hash of two inputs
    function complainAboutNode (uint _indexOut, uint _indexIn,
        bytes32 _Zout, bytes32 _Zin1, bytes32 _Zin2, bytes32[depth] _proofZout,
        bytes32[depth] _proofZin) allowed(receiver, stage.keyRevealed) public {

        require (vrfy(_indexOut, _Zout, _proofZout));
        bytes32 Xout = cryptSmall(_indexOut, _Zout);

        require (vrfy(_indexIn, _Zin1, _proofZin));
        require (_proofZin[0] == _Zin2);

        if (Xout != keccak256(cryptSmall(_indexIn, _Zin1), cryptSmall(_indexIn+1, _Zin2))) {
            selfdestruct(receiver);
        }

    }


    // refund function is called in case some party did not contribute in time
    function refund () public {
        require (now > timeout);
        if (phase == stage.accepted) selfdestruct (receiver);
        if (phase >= stage.keyRevealed) selfdestruct (sender);
    }



    // function to both encrypt and decrypt text chunks with key k
    function cryptLarge (uint _index, bytes32[length] _ciphertext) public view returns (bytes32[length]){

        _index = _index*length;
        for (uint i = 0; i < length; i++){
            _ciphertext[i] = keccak256(_index, key) ^ _ciphertext[i];
            _index++;
        }
        return _ciphertext;
    }

    // function to decrypt hashes of the merkle tree
    function cryptSmall (uint _index, bytes32 _ciphertext) public view returns (bytes32){

        return keccak256(n+_index, key) ^ _ciphertext;
    }


    // function to verify Merkle Tree proofs
    function vrfy(uint _index, bytes32 _value, bytes32[depth] _proof) public view returns (bool){

        for (uint8 i = 0; i < 3; i++){
            if ((_index & 1<<i)>>i == 1)
                _value = keccak256(_proof[3 -i], _value);
            else
                _value = keccak256(_value, _proof[3 -i]);
        }
        return (_value == chiphertextRoot);
    }
}
