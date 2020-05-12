const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const OtJsonUtilities = require('../../modules/OtJsonUtilities');
const Utilities = require('../../modules/Utilities');

describe('OtJson Utilities module', () => {
    it('Sort object recursively', () => {
        const properties = {
            c: 1,
            b: 'abc',
            a: {
                y: [3, 2, {
                    c: null, b: [3, 2, 1], a: undefined, s: 3,
                }, 1, 0],
                x: [9, 8, 7, 6, { x: 1, y: 2 }, 5, [6, 5, 4, 3, 1]],
            },
        };
        const object = {
            a: 1,
            b: 'abc',
            c: { d: [1, 2, 3, { e: null, x: undefined, properties }, { y: 1, f: 2 }] },
        };

        const sortedObject = {
            a: 1,
            b: 'abc',
            c: {
                d: [1, 2, 3, {
                    e: null,
                    properties: {
                        a: {
                            x: [
                                9,
                                8,
                                7,
                                6,
                                {
                                    x: 1,
                                    y: 2,
                                },
                                5,
                                [
                                    6,
                                    5,
                                    4,
                                    3,
                                    1,
                                ],
                            ],
                            y: [
                                3,
                                2,
                                {
                                    a: null,
                                    b: [
                                        3,
                                        2,
                                        1,
                                    ],
                                    c: null,
                                    s: 3,
                                },
                                1,
                                0,
                            ],
                        },
                        b: 'abc',
                        c: 1,
                    },
                    x: null,
                },
                {
                    f: 2,
                    y: 1,
                },
                ],
            },
        };
        assert.deepEqual(sortedObject, OtJsonUtilities.sortObjectRecursively(object));
    });
});
