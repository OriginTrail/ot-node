pragma solidity ^0.4.23;


contract fileSale {

    uint constant depth = 14;
    uint constant length = 2;
    uint constant n = 16384;

    enum stage {created, initialized, accepted, keyRevealed, finished}
    stage public phase = stage.created;
    uint public timeout;

    address sender;
    address receiver;
    uint price = 100; // in wei

    bytes32 keyCommit ;
    bytes32 ciphertextRoot ;
    bytes32 fileRoot ;

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
    function ininitialize (address _receiver, uint _price, bytes32 _keyCommit, bytes32 _ciphertextRoot, bytes32 _fileRoot) public {

        require(phase == stage.created);
        receiver = _receiver;
        sender = msg.sender;
        price = _price;
        keyCommit = _keyCommit;
        ciphertextRoot = _ciphertextRoot;
        fileRoot = _fileRoot;

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

        sender.call.value(price);
        phase = stage.created;
    }

    // function complain about wrong hash of file
    function complainAboutRoot (bytes32 _Zm, bytes32[depth] _proofZm) allowed( receiver, stage.keyRevealed) public {

        require (vrfy(2*(n-1), _Zm, _proofZm));
        if (cryptSmall(2*(n-1), _Zm) != fileRoot){
            receiver.call.value(price);
            phase = stage.created;
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
            receiver.call.value(price);
            phase = stage.created;
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
            receiver.call.value(price);
            phase = stage.created;
        }

    }


    // refund function is called in case some party did not contribute in time
    function refund () public {
        require (now > timeout);
        if (phase == stage.accepted) {

            receiver.call.value(price);
            phase = stage.created;
        }
        else if (phase >= stage.keyRevealed) {

            sender.call.value(price);
            phase = stage.created;
        }
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

        return keccak256(_index, key) ^ _ciphertext;
    }


    // function to verify Merkle Tree proofs
    function vrfy(uint _index, bytes32 _value, bytes32[depth] _proof) public view returns (bool){

        for (uint i = 0; i < 3; i++){
            if ((_index & 1<<i)>>i == 1)
                _value = keccak256(_proof[3 -i], _value);
            else
                _value = keccak256(_value, _proof[3 -i]);
        }
        return (_value == ciphertextRoot);
    }
}