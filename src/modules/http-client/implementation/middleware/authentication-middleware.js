const parseIp = (req) => {
    let xForwardedFor;
    let socketRemoteAddress;

    if (req.headers['x-forwarded-for']) {
        xForwardedFor = req.headers['x-forwarded-for'].split(',').shift();
    }

    if (req.socket) {
        socketRemoteAddress = req.socket.remoteAddress;
    }

    return xForwardedFor || socketRemoteAddress;
};

export default (authService) => async (req, res, next) => {
    const operation = req.url.split('/')[1].split('?')[0].toUpperCase();

    if (authService.isPublicOperation(operation)) {
        return next();
    }

    const ip = parseIp(req);

    const token =
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ') &&
        req.headers.authorization.split(' ')[1];

    const isAuthenticated = await authService.authenticate(ip, token);

    if (!isAuthenticated) {
        return res.status(401).send('Unauthenticated.');
    }

    next();
};
