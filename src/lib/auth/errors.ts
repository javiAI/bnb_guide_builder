/**
 * Typed errors for authentication and ownership checks.
 * Agnóstic of HTTP/UI surface — handlers (API routes, pages) translate to appropriate responses.
 */

export class AuthRequiredError extends Error {
  constructor(message = 'Session required') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

export class PropertyNotFoundError extends Error {
  readonly propertyId: string

  constructor(propertyId: string, message?: string) {
    super(message || `Property not found: ${propertyId}`)
    this.name = 'PropertyNotFoundError'
    this.propertyId = propertyId
  }
}

export class PropertyForbiddenError extends Error {
  readonly propertyId: string
  readonly workspaceId?: string

  constructor(
    propertyId: string,
    options?: {
      reason?: string
      expectedWorkspaceId?: string
      actualWorkspaceId?: string
    }
  ) {
    const details = options?.reason ? `: ${options.reason}` : ''
    super(`Access denied to property ${propertyId}${details}`)
    this.name = 'PropertyForbiddenError'
    this.propertyId = propertyId
    this.workspaceId = options?.expectedWorkspaceId
  }
}
