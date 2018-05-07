const sha3 = require('solidity-sha3').default;
const BN = require('bn.js');
const crypto = require('crypto');

class ZK {

    constructor() {
        this.zero = new BN(0);
        this.one = new BN(1);
        this.p = new BN(941078291);
        this.q = new BN(941072309);
        this.n = this.p.mul(this.q);
        this.nSquare = this.n.mul(this.n);
        this.red = BN.red(this.n);
        this.redSquare = BN.red(this.nSquare);
        this.g = this.n.add(this.one).toRed(this.redSquare);
    }

    encrypt(m, r) {
        return (this.g).redPow(m).redMul(r.redPow(this.n));
    }

    generatePrime() {
        let isPrime;
        let pr;

        let thousand = new BN(1000);

        do {

            isPrime = false

            pr = crypto.randomBytes(8);
            pr = (new BN(pr.toString('hex'))).add(thousand);

            isPrime = this.n.gcd(pr).eq(this.one) && !pr.gte(this.n);

        } while(isPrime != true);

        return pr;
    }

    P(importId, eventId, inputQuantities, outputQuantities) {

        let e = new BN(parseInt(sha3(importId, eventId).substring('0','10')));

        let r = new BN(this.generatePrime()).mod(this.n);

        let a = this.encrypt(this.zero, r.toRed(this.redSquare));

        let inputs = [];
        let outputs = [];

        let R = new BN(1).toRed(this.redSquare);
        let Z = this.one.toRed(this.redSquare);

        //let rs = [];

        for (let i in inputQuantities) {

            let rawQuantity = inputQuantities[i].quantity
            let quantity = new BN(rawQuantity);
            let unit = inputQuantities[i].unit;

            var randomness;
            if (inputQuantities[i].r != undefined) {
                randomness = new BN(inputQuantities[i].r).mod(this.n).toRed(this.redSquare)
            } else {
                randomness = new BN(this.generatePrime()).mod(this.n).toRed(this.redSquare)
            }
            // let negRandomness = new BN(Math.floor(Math.random()*1000000000)).mod(this.n).toRed(this.redSquare)

            let encryptedInput = this.encrypt(quantity, randomness);
            // let encryptedNegInput = this.encrypt(this.n.sub(quantity), negRandomness);

            //rs.push(randomness.toNumber())

            R = R.redMul(randomness);
            Z = Z.redMul(encryptedInput)

            inputs.push(
                {
                    object: inputQuantities[i].object,
                    public: {
                        enc: encryptedInput,
                        //	encNeg: encryptedNegInput,
                        unit : unit,
                    },
                    private: {
                        r  : randomness,
                        //	rp : negRandomness,
                        quantity : rawQuantity,
                        unit : unit,
                    }
                });
        }

        for (let i in outputQuantities) {

            let rawQuantity = outputQuantities[i].quantity
            let quantity = new BN(rawQuantity);
            let unit = outputQuantities[i].unit;

            var randomness;
            if (outputQuantities[i].r != undefined) {
                randomness = new BN(outputQuantities[i].r).mod(this.n).toRed(this.redSquare)
            } else {
                randomness = new BN(this.generatePrime()).mod(this.n).toRed(this.redSquare)
            }
            // let negRandomness = new BN(Math.floor(Math.random()*1000000000)).mod(this.n).toRed(this.redSquare)

            let encryptedOutput = this.encrypt(quantity, randomness);
            let encryptedNegOutput = encryptedOutput.redInvm() // this.encrypt(this.n.sub(quantity), negRandomness);

            // rs.push(randomness.toNumber())

            R = R.redMul(randomness.redInvm());
            Z = Z.redMul(encryptedNegOutput);

            outputs.push(
                {
                    object: outputQuantities[i].object,
                    public: {
                        enc: encryptedOutput.toString('hex'),
                        //encNeg: '0x' + encryptedNegOutput.toString('hex'),
                        unit : unit,
                    },
                    private: {
                        object: outputQuantities[i].object,
                        r  : randomness,
                        //rp : negRandomness,
                        quantity : rawQuantity,
                        unit : unit,
                    }
                });
        }


        r = r.toRed(this.redSquare);
        let zp = r.redMul(R.redPow(e))

        let res = this.V(e, a, Z, zp);
        /*
                if (res == false) {
                    console.log(R.toNumber());
                    console.log(rs);
                    console.log(Z.toNumber());
                    console.log(e.toNumber());
                    console.log(a.toNumber());
                    console.log(r.toNumber());
                    console.log(zp.toNumber());
                }
        */
        let zkObject = {
            inputs: inputs,
            outputs: outputs,
            e: e.toString('hex'),
            a: a.toString('hex'),
            zp: zp.toString('hex'),
            importId: importId
        }

        // return res;
        console.log(res)
        return zkObject;
    }

    V(e, a, Z, zp) {
        return this.encrypt(this.zero, zp.fromRed().toRed(this.redSquare)).eq(a.redMul(Z.redPow(e)))
    }
}


inputQuantities = [{object: 'abcd', quantity: 3, unit: 'kg'},{object: 'efgh', quantity: 13, unit: 'kg'},{object: 'ijkl', quantity: 2, unit: 'kg'}];
outputQuantities = [{object: 'mnop', quantity: 4, unit: 'kg'},{object: 'qrst', quantity: 11, r:16, unit: 'kg'},{object: 'uvwx', quantity: 2, unit: 'kg'}];

module.exports = ZK;
/*
while(zk.P(12322, 'E-123', inputQuantities, outputQuantities) == true) {

}*/

// console.log((zk.P(12322, 'E-123', inputQuantities, outputQuantities)))