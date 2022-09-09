const getToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
};

export default (authService) => async (req, res, next) => {
    const operation = req.url.split('/')[1].toUpperCase();

    if (authService.isPublicOperation(operation)) {
        return next();
    }

    const token = getToken(req);
    const isAuthorized = await authService.isAuthorized(token, operation);

    if (!isAuthorized) {
        return res.status(403).send('Forbidden.');
    }

    next();
};
