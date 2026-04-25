import { redirect, notFound } from 'next/navigation'
import {
  AuthRequiredError,
  PropertyNotFoundError,
  PropertyForbiddenError,
} from './errors'

/**
 * Handle ownership check errors in server page components/layouts.
 * Translates typed errors to Next.js page responses (redirect/notFound/forbidden).
 *
 * @throws {Error} For any error not recognized as ownership/auth error
 */
export function handleOwnershipPageError(err: unknown): never {
  if (err instanceof AuthRequiredError) {
    // No valid session — redirect to login
    redirect('/login')
  }

  if (err instanceof PropertyNotFoundError) {
    // Property doesn't exist
    notFound()
  }

  if (err instanceof PropertyForbiddenError) {
    // Operator lacks access — forbidden
    // In operator app, this should not happen in normal flow,
    // but if it does, treat as 404 to avoid leaking ownership info
    notFound()
  }

  // Not an ownership error; let caller handle
  throw err
}
