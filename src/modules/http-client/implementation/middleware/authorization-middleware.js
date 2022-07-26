const getToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
};

module.exports = (authService) => async (req, res, next) => {
    const action = req.url.split('/')[1].toUpperCase();

    if (authService.isPublicAction(action)) {
        return next();
    }

    const token = getToken(req);
    const isAuthorized = await authService.isAuthorized(token, action);

    if (!isAuthorized) {
        return res.status(403).send('Forbidden.');
    }

    next();
};
