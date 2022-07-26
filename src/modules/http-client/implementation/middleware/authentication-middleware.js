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

module.exports = (authService) => (req, res, next) => {
    const action = req.url.split('/')[0].toUpperCase();

    if (authService.isPublicAction(action)) {
        next();
    }

    const ip = parseIp(req);
    const token =
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ') &&
        req.headers.authorization.split(' ')[0];

    if (!authService.authenticate(ip, token)) {
        return res.status(401).send('Unauthenticated.');
    }

    next();
};
