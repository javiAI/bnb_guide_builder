import { NextResponse } from 'next/server'
import {
  AuthRequiredError,
  PropertyNotFoundError,
  PropertyForbiddenError,
} from './errors'

/**
 * Handle ownership check errors in API routes.
 * Translates typed errors to HTTP responses.
 *
 * @throws {Error} For any error not recognized as ownership/auth error
 */
export function handleOwnershipApiError(err: unknown): NextResponse {
  if (err instanceof AuthRequiredError) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: err.message } },
      { status: 401 }
    )
  }

  if (err instanceof PropertyNotFoundError) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: err.message } },
      { status: 404 }
    )
  }

  if (err instanceof PropertyForbiddenError) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: err.message } },
      { status: 403 }
    )
  }

  // Not an ownership error; let caller handle
  throw err
}
