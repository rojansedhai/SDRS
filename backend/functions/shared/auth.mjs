/**
 * Authentication and authorization helpers for SDRS Lambda handlers.
 * Extracts caller identity strictly from API Gateway JWT authorizer 'sub' claim.
 * In accordance with zero-trust design:
 * - userId must ALWAYS come from verified JWT 'sub'.
 * - Never accept client-supplied userIds as authoritative.
 * - Never fall back to 'anonymous' or unauthenticated identifiers.
 */

/**
 * Extracts authenticated user ID strictly from the JWT 'sub' claim.
 * @param {object} event - API Gateway HTTP API event
 * @returns {string|null} The authenticated user ID (sub claim only)
 */
export function getAuthenticatedUserId(event) {
  // Extract strictly from HTTP API JWT Authorizer claims
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof sub === 'string' && sub.trim().length > 0) {
    return sub.trim();
  }

  // Fallback check for custom Lambda authorizer if claims are top-level
  const lambdaAuthorizerSub = event?.requestContext?.authorizer?.claims?.sub;
  if (typeof lambdaAuthorizerSub === 'string' && lambdaAuthorizerSub.trim().length > 0) {
    return lambdaAuthorizerSub.trim();
  }

  return null;
}

/**
 * Validates that the request has an authenticated user, returning HTTP 401 Unauthorized if missing.
 * @param {object} event - API Gateway HTTP API event
 * @returns {{ errorResponse: object|null, userId: string|null }}
 */
export function requireAuth(event) {
  const userId = getAuthenticatedUserId(event);
  if (!userId) {
    return {
      errorResponse: {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Missing or invalid authentication token. A valid JWT token with a verified "sub" claim is required in the Authorization header.'
        })
      },
      userId: null
    };
  }
  return { errorResponse: null, userId };
}

/**
 * Returns a 403 Forbidden response when a user attempts to access or mutate an unowned resource.
 * @param {string} resourceOwnerId - Expected owner ID from database
 * @param {string} callerUserId - Caller's user ID from verified JWT sub
 * @returns {object} HTTP 403 response
 */
export function forbiddenResponse(resourceOwnerId, callerUserId) {
  return {
    statusCode: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Forbidden',
      message: `Caller '${callerUserId}' is not authorized to access or modify resource owned by '${resourceOwnerId}'.`
    })
  };
}
