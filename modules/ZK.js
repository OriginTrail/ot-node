const sha3 = require('solidity-sha3').default;
const BN = require('bn.js');
const crypto = require('crypto');

class ZK {
    constructor(ctx) {
        this.zero = new BN(0);
        this.one = new BN(1);
        this.p = new BN(941078291);
        this.q = new BN(941072309);
        this.n = this.p.mul(this.q);
        this.nSquare = this.n.mul(this.n);
        this.red = BN.red(this.n);
        this.redSquare = BN.red(this.nSquare);
        this.g = this.n.add(this.one).toRed(this.redSquare);

        this.log = ctx.logger || console;
    }

    encrypt(m, r) {
        return (this.g).redPow(m).redMul(r.redPow(this.n));
    }

    generateR() {
        return new BN(this.generatePrime()).mod(this.n);
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

    P(eventId, inputQuantities, outputQuantities) {
        const all_units = {};
        const response = {};
        const batches = {};

        for (const input of inputQuantities) {
            const { unit } = input;
            if (all_units[unit] == null) {
                all_units[unit] = true;
            }

            if (batches[input.object] == null) {
                batches[input.object] = {};
            }

            batches[input.object][unit] = this.encrypt(new BN(input.quantity), new BN(input.r));
        }

        for (const output of outputQuantities) {
            const { unit } = output;
            if (all_units[output] == null) {
                all_units[output] = true;
            }

            if (batches[output.object] == null) {
                batches[output.object] = {};
            }

            batches[output.object][unit] = this.encrypt(new BN(output.quantity), new BN(output.r));
        }

        for (const unit of all_units) {
            response[unit] = this._P(eventId, inputQuantities, outputQuantities, unit);
        }

        return { quantities: response, batches };
    }

    _P(eventId, inputQuantities, outputQuantities, unit) {
        const e = new BN(sha3(eventId).substring(0, 10), 16);

        let r = this.generateR();

        const a = this.encrypt(this.zero, r.toRed(this.redSquare));

        const inputs = [];
        const outputs = [];

        let R = new BN(1).toRed(this.redSquare);
        let Z = this.one.toRed(this.redSquare);

        // let rs = [];

        for (const i in inputQuantities) {
            if (inputQuantities[i].unit === unit) {
                const rawQuantity = inputQuantities[i].quantity;
                const quantity = new BN(rawQuantity);

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
                    },
                    private: {
                        object: inputQuantities[i].object,
                        r: randomness.toString(),
                        quantity: rawQuantity,
                    },
                });
            }
        }

        for (const i in outputQuantities) {
            if (outputQuantities[i].unit === unit) {
                const rawQuantity = outputQuantities[i].quantity;
                const quantity = new BN(rawQuantity);

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
                        r: randomness.toString(),
                        // rp : negRandomness,
                        quantity: rawQuantity,
                        unit,
                    },
                });
            }
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
        };

        // return res;
        if (res) {
            this.log.debug('ZK proof successfully created and validated for event: ', eventId);
        } else {
            this.log.debug('ZK proof failed for event: ', eventId);
        }
        return zkObject;
    }

    V(e, a, Z, zp) {
        if (typeof e === 'string') {
            e = new BN(e, 16);
        }

        if (typeof a === 'string') {
            a = (new BN(a, 16)).toRed(this.redSquare);
        }

        if (typeof zp === 'string') {
            zp = (new BN(zp, 16)).toRed(this.redSquare);
        }

        if (typeof Z === 'string') {
            Z = (new BN(Z, 16)).toRed(this.redSquare);
        }

        return this.encrypt(this.zero, zp.fromRed().toRed(this.redSquare))
            .eq(a.redMul(Z.redPow(e)));
    }

    calculateZero(inputs, outputs) {
        let calculated = this.one;
        calculated = calculated.toRed(this.redSquare);

        for (const inputValue of inputs) {
            calculated = calculated.redMul((new BN(inputValue, 16))
                .toRed(this.redSquare));
        }

        for (const outputValue of outputs) {
            calculated = calculated.redMul((new BN(outputValue, 16))
                .toRed(this.redSquare).redInvm());
        }
        return calculated.toString('hex');
    }
}

module.exports = ZK;
