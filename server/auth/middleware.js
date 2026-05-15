import jwt from 'jsonwebtoken';

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

function classifyJwtError(err) {
  if (err?.name === 'TokenExpiredError') return 'expired';
  if (err?.name === 'JsonWebTokenError') {
    return err.message === 'jwt malformed' ? 'malformed' : 'signature';
  }
  return 'other';
}

function resolveLoggedPath(req) {
  if (typeof req.originalUrl === 'string') {
    return req.originalUrl.split('?')[0];
  }
  return req.path;
}

export function createRequireAuth({ jwtSecret, logger = console } = {}) {
  if (!jwtSecret) {
    throw new Error('createRequireAuth requires a jwtSecret');
  }

  return function requireAuth(req, res, next) {
    const header = req.headers?.authorization;
    const path = resolveLoggedPath(req);

    if (!header) {
      logger.warn('[auth] reject', { category: 'missing', path });
      return res.status(401).json(UNAUTHORIZED_BODY);
    }

    if (!header.startsWith('Bearer ')) {
      logger.warn('[auth] reject', { category: 'malformed', path });
      return res.status(401).json(UNAUTHORIZED_BODY);
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      req.user = { id: payload.sub, email: payload.email };
      return next();
    } catch (err) {
      logger.warn('[auth] reject', {
        category: classifyJwtError(err),
        path,
      });
      return res.status(401).json(UNAUTHORIZED_BODY);
    }
  };
}
