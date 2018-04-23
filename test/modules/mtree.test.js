const { describe, it } = require('mocha');
const { assert, expect } = require('chai');

const MTree = require('../../modules/mtree')();

describe('MTree module', () => {
    const myData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const alsoMyData = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const myRoot = 'aa7a7d7ebe68bc402a96b286ee29e8b008466e59d081e2f28065c5931f6c31e6';
    const alsoMyRoot = '6d1b77a76bc2984c4e381fe2eda402749866d5da1adb946f9358ec9288f0ceee';
    const myMTree = new MTree(myData);
    const alsoMyTree = new MTree(alsoMyData);

    it('root() ', () => {
        assert.equal(myMTree.root(), myRoot);
        assert.equal(myMTree.root().length, 64);
        assert.equal(alsoMyTree.root(), alsoMyRoot);
        assert.equal(alsoMyTree.root().length, 64);

        expect(myMTree).to.be.an.instanceof(MTree);
        expect(alsoMyTree).to.be.an.instanceof(MTree);
    });

    it('digestFn() ', () => {
        const digestFn = myMTree.digestFn('sha256', myData);
        const result = 'ef58d7c6937c627ace93d94e1045c06ff884c23bbb9f4aa5c1bb276842be4629';
        assert.equal(digestFn, result);
        assert.equal(digestFn.length, 64);
    });

    it('findIndex() ', () => {
        assert.equal(myMTree.findIndex(9), 8);
        assert.equal(myMTree.findIndex(10), 9);
        assert.equal(myMTree.findIndex(1), 0);
        assert.equal(myMTree.findIndex(2), 1);
        assert.equal(myMTree.findIndex(3), 2);

        assert.equal(alsoMyTree.findIndex('b'), 1);
        assert.equal(alsoMyTree.findIndex('j'), 9);
    });

    it('verifyLeaf() ', () => {
        assert.isTrue(myMTree.verifyLeaf(0));
        assert.isTrue(myMTree.verifyLeaf(2));
        assert.isTrue(myMTree.verifyLeaf(6));
        assert.isTrue(myMTree.verifyLeaf(9));

        assert.isFalse(myMTree.verifyLeaf(-1));
        assert.isFalse(myMTree.verifyLeaf(10));

        assert.isTrue(alsoMyTree.verifyLeaf(1));
        assert.isTrue(alsoMyTree.verifyLeaf(7));
        assert.isFalse(alsoMyTree.verifyLeaf(17));
    });

    it('verifyLeaves() ', () => {
        assert.isTrue(myMTree.verifyLeaves([8, 9, 10]));
        assert.isTrue(myMTree.verifyLeaves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
        assert.isTrue(myMTree.verifyLeaves([1, 2, 3, 9, 10]));

        assert.isFalse(myMTree.verifyLeaves([9, 10, 11]));
        assert.isFalse(myMTree.verifyLeaves([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

        assert.isTrue(alsoMyTree.verifyLeaves(['a', 'b', 'c', 'd', 'e']));
        assert.isTrue(alsoMyTree.verifyLeaves(['e', 'd', 'g', 'h', 'i']));

        assert.isFalse(alsoMyTree.verifyLeaves(['e', 'd', '5', 'h', 'i']));
    });
});
