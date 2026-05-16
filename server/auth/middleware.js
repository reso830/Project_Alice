import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

function classifyJoseError(err) {
  if (err instanceof joseErrors.JWTExpired) return 'expired';
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) return 'signature';
  if (err instanceof joseErrors.JWKSNoMatchingKey) return 'signature';
  if (err instanceof joseErrors.JOSEAlgNotAllowed) return 'signature';
  if (err instanceof joseErrors.JWSInvalid) return 'malformed';
  if (err instanceof joseErrors.JWTInvalid) return 'malformed';
  return 'other';
}

function resolveLoggedPath(req) {
  if (typeof req.originalUrl === 'string') {
    return req.originalUrl.split('?')[0];
  }
  return req.path;
}

export function createRequireAuth({ jwksUri, jwks, logger = console } = {}) {
  if (!jwksUri && !jwks) {
    throw new Error(
      'createRequireAuth requires a jwksUri (or an explicit jwks getKey function for tests)',
    );
  }
  const getKey = jwks ?? createRemoteJWKSet(new URL(jwksUri));

  return async function requireAuth(req, res, next) {
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
      const { payload } = await jwtVerify(token, getKey, {
        algorithms: ALLOWED_ALGORITHMS,
      });
      req.user = { id: payload.sub, email: payload.email };
      return next();
    } catch (err) {
      logger.warn('[auth] reject', {
        category: classifyJoseError(err),
        path,
      });
      return res.status(401).json(UNAUTHORIZED_BODY);
    }
  };
}
