const getToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
};

export default (authService) => async (req, res, next) => {
    // eslint-disable-next-line no-useless-escape
    const match = req.path.match(/^\/(?:v[0-9]+\/)?([^\/\?]+)/);
    if (!match) return res.status(404).send('Not found.');

    const operation = match[0].substring(1).toUpperCase();

    if (authService.isPublicOperation(operation)) {
        return next();
    }

    const token = getToken(req);
    if (token) {
        const isAuthorized = await authService.isAuthorized(token, operation);

        if (!isAuthorized) {
            return res.status(403).send('Forbidden.');
        }
    }

    next();
};
