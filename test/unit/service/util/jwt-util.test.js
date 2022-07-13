require('dotenv').config();
const uuid = require('uuid').v4;
const { expect } = require('chai');

const { describe, it } = require('mocha');
const jwt = require('jsonwebtoken');

const jwtUtil = require('../../../../src/service/util/jwt-util');

const nonJwts = [
    '123',
    214214124124,
    'header.payload.signature',
    null,
    undefined,
    true,
    false,
    {},
    [],
];

describe('Auth JWT generation', async () => {
    it('generates JWT token with tokenId payload', () => {
        const tokenId = uuid();
        const token = jwtUtil.generateJWT(tokenId);

        expect(token).not.be.null;
        expect(jwt.decode(token).jti).to.be.equal(tokenId);
    });

    it('generates null if invalid tokenId is provided', () => {
        const nonUuids = [true, false, undefined, null, {}, [], 'string', 123];

        for (const val of nonUuids) {
            const token = jwtUtil.generateJWT(val);
            expect(token).to.be.null;
        }
    });

    it('generates payload without expiration date if expiresIn argument is not provided', () => {
        const token = jwtUtil.generateJWT(uuid());
        expect(jwt.decode(token).exp).to.be.undefined;
    });

    it('generates payload with expiration date if expiresIn argument is  provided', () => {
        const token = jwtUtil.generateJWT(uuid(), '2d');
        expect(jwt.decode(token).exp).to.be.ok;
    });
});

describe('JWT token validation', async () => {
    it('returns true if JWT is valid', async () => {
        const token = jwtUtil.generateJWT(uuid());
        expect(jwtUtil.validateJWT(token)).to.be.true;
    });

    it('returns false if JWT is not valid', async () => {
        const token =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        expect(jwtUtil.validateJWT(token)).to.be.false;
    });

    it('returns false if non JWT value is passed', async () => {
        for (const val of nonJwts) {
            expect(jwtUtil.validateJWT(val)).to.be.false;
        }
    });
});

describe('JWT payload extracting', async () => {
    it('returns JWT payload if valid token is provided', async () => {
        const token = jwtUtil.generateJWT(uuid());

        expect(jwtUtil.getPayload(token)).to.be.ok;
    });

    it('returns null if invalid token is provided', async () => {
        for (const val of nonJwts) {
            expect(jwtUtil.getPayload(val)).to.be.null;
        }
    });
});

describe('JWT decoding', async () => {
    it('returns decoded JWT (header, payload, signature) if valid token is provided', async () => {
        const token = jwtUtil.generateJWT(uuid());

        expect(jwtUtil.decode(token).header).to.be.ok;
        expect(jwtUtil.decode(token).payload).to.be.ok;
        expect(jwtUtil.decode(token).signature).to.be.ok;
    });

    it('returns null if invalid token is provided', async () => {
        for (const val of nonJwts) {
            expect(jwtUtil.decode(val)).to.be.null;
        }
    });
});
