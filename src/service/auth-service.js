import ipLib from 'ip';
import ethers from 'ethers';
import jwtUtil from './util/jwt-util.js';

class AuthService {
    constructor(ctx) {
        this._authConfig = ctx.config.auth;
        this._repository = ctx.repositoryModuleManager;
        this._logger = ctx.logger;
    }

    /**
     * Authenticate users based on provided ip and token
     * @param ip
     * @param token
     * @param credential
     * @returns {boolean}
     */
    async authenticate(ip, token, credential = null) {
        const isWhitelisted = this._isIpWhitelisted(ip);
        const isTokenValid = await this._isTokenValid(token);
        const isVPValid = await this._isVerifiablePresentationValid(
            credential,
            this._authConfig.vcBasedAuthEnabled,
        );

        const tokenAuthEnabled = this._authConfig.tokenBasedAuthEnabled;
        const ipAuthEnabled = this._authConfig.ipBasedAuthEnabled;
        const requiresBoth = this._authConfig.bothIpAndTokenAuthRequired;
        const vcAuthEnabled = this._authConfig.vcBasedAuthEnabled;

        let isAuthenticated = false;

        if (vcAuthEnabled) {
            isAuthenticated = isVPValid;
        } else if (tokenAuthEnabled && ipAuthEnabled) {
            isAuthenticated = requiresBoth
                ? isWhitelisted && isTokenValid
                : isWhitelisted || isTokenValid;
        } else {
            isAuthenticated = isWhitelisted && isTokenValid;
        }

        if (!isAuthenticated) {
            this._logMessage('Received unauthenticated request.');
        }

        return isAuthenticated;
    }

    /**
     * Checks whether user whose token is provided has abilities for system operation
     * @param token
     * @param systemOperation
     * @returns {Promise<boolean|*>}
     */
    async isAuthorized(token, systemOperation) {
        if (!this._authConfig.tokenBasedAuthEnabled) {
            return true;
        }

        /*
            If IP is whitelisted and both IP and Token Auth is NOT required pass authorization check.
            Authentication middleware checks if IP is white listed before authorization middleware.
        */
        if (!(await this._isTokenValid(token))) {
            if (
                !this._authConfig.bothIpAndTokenAuthRequired &&
                this._authConfig.ipBasedAuthEnabled
            ) {
                return true;
            }
            return false;
        }

        const tokenId = jwtUtil.getPayload(token).jti;
        const abilities = await this._repository.getTokenAbilities(tokenId);

        const isAuthorized = abilities.includes(systemOperation);

        const logMessage = isAuthorized
            ? `Token ${tokenId} is successfully authenticated and authorized.`
            : `Received unauthorized request.`;

        this._logMessage(logMessage);

        return isAuthorized;
    }

    /**
     * Determines whether operation is listed in config.auth.publicOperations
     * @param operationName
     * @returns {boolean}
     */
    isPublicOperation(operationName) {
        if (!Array.isArray(this._authConfig.publicOperations)) {
            return false;
        }

        return this._authConfig.publicOperations.some(
            (publicOperation) =>
                publicOperation === `V0/${operationName}` || publicOperation === operationName,
        );
    }

    /**
     * Validates token structure and revoked status
     * If ot-node is configured not to do a token based auth, it will return true
     * @param token
     * @returns {boolean}
     * @private
     */
    async _isTokenValid(token) {
        if (!this._authConfig.tokenBasedAuthEnabled) {
            return true;
        }

        if (!token) {
            return false;
        }

        if (!jwtUtil.validateJWT(token)) {
            return false;
        }

        const isRevoked = await this._isTokenRevoked(token);

        return isRevoked !== null && !isRevoked;
    }

    async _isVerifiablePresentationValid(presentation, vcBasedAuthEnabled) {
        if (presentation === null || vcBasedAuthEnabled === undefined) {
            return null;
        }
        try {
            if (typeof presentation === 'string') {
                // eslint-disable-next-line no-param-reassign
                presentation = JSON.parse(presentation);
            }
            const verifiablePresentationContent = { ...presentation };

            const { holder } = verifiablePresentationContent;
            const holderWallet = holder.match(/0x[a-fA-F0-9]{40}$/)[0];

            const credentials = presentation.verifiableCredential;
            for (let i = 0; i < credentials.length; i += 1) {
                if (
                    !this._isVerifiableCredentialValid(
                        JSON.parse(credentials[i]),
                        vcBasedAuthEnabled.issuers,
                    )
                ) {
                    return false;
                }
            }
            return this._isVerifiableCredentialValid(verifiablePresentationContent, [holderWallet]);
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    _isVerifiableCredentialValid(credential, wallets) {
        const verifiableCredentialContent = { ...credential };

        const proof = verifiableCredentialContent.proof.proofValue;
        delete verifiableCredentialContent.proof.eip712.types.EIP712Domain;
        const { domain } = verifiableCredentialContent.proof.eip712;
        const { types } = verifiableCredentialContent.proof.eip712;
        delete verifiableCredentialContent.proof.eip712;
        try {
            const recoveredAddress = ethers.utils.verifyTypedData(
                domain,
                types,
                verifiableCredentialContent,
                proof,
            );
            return (
                wallets.includes(recoveredAddress) ||
                wallets.includes(recoveredAddress.toLowerCase()) ||
                wallets.includes(recoveredAddress.toUpperCase())
            );
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    /**
     * Checks whether provided ip is whitelisted in config
     * Returns false if ip based auth is disabled
     * @param reqIp
     * @returns {boolean}
     * @private
     */
    _isIpWhitelisted(reqIp) {
        if (!this._authConfig.ipBasedAuthEnabled) {
            return true;
        }

        for (const whitelistedIp of this._authConfig.ipWhitelist) {
            let isEqual = false;

            try {
                isEqual = ipLib.isEqual(reqIp, whitelistedIp);
            } catch (e) {
                // if ip is not valid IP isEqual should remain false
            }

            if (isEqual) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks whether provided token is revoked
     * Returns false if token based auth is disabled
     * @param token
     * @returns {Promise<boolean|*>|boolean}
     * @private
     */
    _isTokenRevoked(token) {
        if (!this._authConfig.tokenBasedAuthEnabled) {
            return false;
        }

        const tokenId = jwtUtil.getPayload(token).jti;

        return this._repository.isTokenRevoked(tokenId);
    }

    /**
     * Logs message if loggingEnabled is set to true
     * @param message
     * @private
     */
    _logMessage(message) {
        if (this._authConfig.loggingEnabled) {
            this._logger.info(`[AUTH] ${message}`);
        }
    }
}

export default AuthService;
