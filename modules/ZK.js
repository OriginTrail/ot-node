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

        const thousand = new BN(1000);

        do {
            isPrime = false;

            pr = crypto.randomBytes(8);
            pr = (new BN(pr.toString('hex'))).add(thousand);

            isPrime = this.n.gcd(pr).eq(this.one) && !pr.gte(this.n);
        } while (isPrime !== true);

        return pr;
    }

    P(importId, eventId, inputQuantities, outputQuantities) {
        const e = new BN(parseInt(sha3(importId, eventId).substring('0', '10'), 10));

        let r = new BN(this.generatePrime()).mod(this.n);

        const a = this.encrypt(this.zero, r.toRed(this.redSquare));

        const inputs = [];
        const outputs = [];

        let R = new BN(1).toRed(this.redSquare);
        let Z = this.one.toRed(this.redSquare);

        // let rs = [];

        for (const i in inputQuantities) {
            const rawQuantity = inputQuantities[i].quantity;
            const quantity = new BN(rawQuantity);
            const { unit } = inputQuantities[i];

            let randomness;
            if (inputQuantities[i].r !== undefined) {
                randomness = new BN(inputQuantities[i].r).mod(this.n).toRed(this.redSquare);
            } else {
                randomness = new BN(this.generatePrime()).mod(this.n).toRed(this.redSquare);
            }

            const encryptedInput = this.encrypt(quantity, randomness);
            // let encryptedNegInput = this.encrypt(this.n.sub(quantity), negRandomness);

            // rs.push(randomness.toNumber())

            R = R.redMul(randomness);
            Z = Z.redMul(encryptedInput);

            inputs.push({
                object: inputQuantities[i].object,
                added: inputQuantities[i].added,
                public: {
                    enc: encryptedInput,
                    unit,
                },
                private: {
                    r: randomness,
                    quantity: rawQuantity,
                    unit,
                },
            });
        }

        for (const i in outputQuantities) {
            const rawQuantity = outputQuantities[i].quantity;
            const quantity = new BN(rawQuantity);
            const { unit } = outputQuantities[i];

            let randomness;
            if (outputQuantities[i].r !== undefined) {
                randomness = new BN(outputQuantities[i].r).mod(this.n).toRed(this.redSquare);
            } else {
                randomness = new BN(this.generatePrime()).mod(this.n).toRed(this.redSquare);
            }

            const encryptedOutput = this.encrypt(quantity, randomness);
            const encryptedNegOutput = encryptedOutput.redInvm();

            // rs.push(randomness.toNumber())

            R = R.redMul(randomness.redInvm());
            Z = Z.redMul(encryptedNegOutput);

            outputs.push({
                object: outputQuantities[i].object,
                added: outputQuantities[i].added,
                public: {
                    enc: encryptedOutput.toString('hex'),
                    // encNeg: '0x' + encryptedNegOutput.toString('hex'),
                    unit,
                },
                private: {
                    object: outputQuantities[i].object,
                    r: randomness,
                    // rp : negRandomness,
                    quantity: rawQuantity,
                    unit,
                },
            });
        }


        r = r.toRed(this.redSquare);
        const zp = r.redMul(R.redPow(e));

        const res = this.V(e, a, Z, zp);
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
        const zkObject = {
            inputs,
            outputs,
            e: e.toString('hex'),
            a: a.toString('hex'),
            zp: zp.toString('hex'),
            importId,
        };

        // return res;
        console.log(res);
        return zkObject;
    }

    V(e, a, Z, zp) {
        return this.encrypt(this.zero, zp.fromRed().toRed(this.redSquare))
            .eq(a.redMul(Z.redPow(e)));
    }
}

module.exports = ZK;
