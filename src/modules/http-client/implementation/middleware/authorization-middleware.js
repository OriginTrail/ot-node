const getToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
};

module.exports = (authService) => (req, res, next) => {
    const action = req.url.split('/')[0].toUpperCase();

    if (authService.isPublicAction(action)) {
        next();
    }

    const token = getToken(req);

    if (!authService.isAuthorized(token, action)) {
        return res.status(403).send('Forbidden.');
    }

    next();
};
