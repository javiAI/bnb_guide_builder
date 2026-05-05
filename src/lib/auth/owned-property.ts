import { prisma } from '@/lib/db'
import { Property } from '@prisma/client'
import { requireOperator, type OperatorContext } from './require-operator'
import {
  AuthRequiredError,
  PropertyNotFoundError,
  PropertyForbiddenError,
} from './errors'

export interface OwnedPropertyResult {
  property: Property
  operator: OperatorContext
}

/**
 * Load a property and verify ownership by the current operator.
 *
 * Three-step check:
 * 1. Validate session (throws AuthRequiredError if no valid session)
 * 2. Load property (throws PropertyNotFoundError if not found)
 * 3. Verify ownership: property.workspaceId must match operator.workspaceId (throws PropertyForbiddenError)
 *
 * Returns both property and operator context for use in handlers (audit logs, etc).
 *
 * @throws {AuthRequiredError} If no valid session
 * @throws {PropertyNotFoundError} If property does not exist
 * @throws {PropertyForbiddenError} If operator lacks access (workspace mismatch)
 */
export async function loadOwnedProperty(
  propertyId: string
): Promise<OwnedPropertyResult> {
  // Step 1: Validate session
  let operator: OperatorContext
  try {
    operator = await requireOperator()
  } catch {
    throw new AuthRequiredError('Valid session required to access property')
  }

  // Step 2: Load property from DB (all fields)
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  })

  if (!property) {
    throw new PropertyNotFoundError(propertyId)
  }

  // Step 3: Verify workspace ownership (source of truth: Property.workspaceId)
  if (property.workspaceId !== operator.workspaceId) {
    throw new PropertyForbiddenError(propertyId, {
      reason: `property belongs to workspace ${property.workspaceId}, but session is in workspace ${operator.workspaceId}`,
      expectedWorkspaceId: operator.workspaceId,
      actualWorkspaceId: property.workspaceId,
    })
  }

  return { property, operator }
}
