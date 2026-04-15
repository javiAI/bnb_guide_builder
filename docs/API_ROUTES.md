# API_CONTRACTS

## 1. General rules

- JSON sobre HTTP
- validación con Zod en toda frontera externa
- errores con shape uniforme
- rutas públicas y de operador claramente separadas

## 2. Route groups

### Properties

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/properties`
- `POST /api/properties`
- `GET /api/properties/:propertyId`
- `PATCH /api/properties/:propertyId`

### Creation wizard

- `GET /api/properties/new/defaults`
- `POST /api/properties/drafts`
- `POST /api/properties/create-usable`

### Wizard sessions

- `GET /api/properties/:propertyId/wizard`
- `POST /api/properties/:propertyId/wizard/start`
- `POST /api/properties/:propertyId/wizard/responses`
- `PATCH /api/wizard-responses/:responseId`
- `POST /api/properties/:propertyId/wizard/complete`

### Canonical editor entities

- `GET /api/properties/:propertyId/spaces`
- `POST /api/properties/:propertyId/spaces`
- `GET /api/spaces/:spaceId`
- `PATCH /api/spaces/:spaceId`

- `GET /api/properties/:propertyId/amenities`
- `POST /api/properties/:propertyId/amenities`
- `GET /api/property-amenities/:amenityId`
- `PATCH /api/property-amenities/:amenityId`

- `GET /api/properties/:propertyId/troubleshooting`
- `POST /api/properties/:propertyId/troubleshooting`
- `GET /api/troubleshooting-playbooks/:playbookId`
- `PATCH /api/troubleshooting-playbooks/:playbookId`

- `GET /api/properties/:propertyId/local-places`
- `POST /api/properties/:propertyId/local-places`
- `GET /api/local-places/:localPlaceId`
- `PATCH /api/local-places/:localPlaceId`

- `GET /api/properties/:propertyId/ops/checklist`
- `POST /api/properties/:propertyId/ops/checklist`
- `GET /api/properties/:propertyId/ops/stock`
- `POST /api/properties/:propertyId/ops/stock`
- `GET /api/properties/:propertyId/ops/maintenance`
- `POST /api/properties/:propertyId/ops/maintenance`

### Media

- `GET /api/properties/:propertyId/media-assets`
- `POST /api/properties/:propertyId/media-assets/request-upload`
- `POST /api/properties/:propertyId/media-assets/complete-upload`
- `PATCH /api/media-assets/:mediaAssetId`
- `POST /api/media-assets/:mediaAssetId/assign`

### Knowledge and guide

- `GET /api/properties/:propertyId/knowledge-items`
- `POST /api/properties/:propertyId/knowledge-items/regenerate`
- `PATCH /api/knowledge-items/:knowledgeItemId`
- `GET /api/knowledge-items/:knowledgeItemId`

- `GET /api/properties/:propertyId/guide-versions`
- `POST /api/properties/:propertyId/guide-versions`
- `GET /api/guide-versions/:guideVersionId`
- `PATCH /api/guide-sections/:guideSectionId`
- `POST /api/guide-versions/:guideVersionId/publish`

### Messaging and automation

- `GET /api/properties/:propertyId/message-templates`
- `POST /api/properties/:propertyId/message-templates`
- `GET /api/message-templates/:messageTemplateId`
- `PATCH /api/message-templates/:messageTemplateId`
- `POST /api/properties/:propertyId/messages/preview`
- `GET /api/properties/:propertyId/message-automations`
- `POST /api/properties/:propertyId/message-automations`
- `PATCH /api/message-automations/:automationId`

### Assistant

- `POST /api/properties/:propertyId/assistant/ask`
- `POST /api/properties/:propertyId/assistant/debug/retrieve`
- `GET /api/properties/:propertyId/assistant/conversations`
- `POST /api/properties/:propertyId/assistant/conversations`
- `GET /api/assistant-conversations/:conversationId/messages`

### Ops and audit

- `GET /api/properties/:propertyId/review-queue`
- `GET /api/properties/:propertyId/audit-log`
- `GET /api/properties/:propertyId/analytics`

## 3. Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid payload",
    "details": {
      "fieldErrors": {}
    }
  }
}
```

## 4. Create usable property request

```json
{
  "workspaceId": "ws_123",
  "draft": {
    "roomType": "entire_place",
    "propertyType": "apartment",
    "propertyNickname": "Alcalá Centro",
    "country": "España",
    "city": "Madrid",
    "timezone": "Europe/Madrid",
    "addressLevel": "exact",
    "streetAddress": "Calle Mayor 10",
    "postalCode": "28013",
    "region": "Madrid",
    "maxGuests": 4,
    "bedroomsCount": 2,
    "bedsCount": 3,
    "bathroomsCount": 1,
    "checkInWindow": {
      "start": "16:00",
      "end": "22:00"
    },
    "checkOutTime": "11:00",
    "primaryAccessMethod": "am.lockbox",
    "hostContactPhone": "+34...",
    "supportContact": "Equipo Alcalá"
  }
}
```

## 5. Assistant ask response

```json
{
  "data": {
    "answer": "La cafetera es de cápsulas y está en la cocina...",
    "citations": [
      {
        "knowledgeItemId": "ki_123",
        "sourceId": "src_123",
        "quoteOrNote": "Cafetera Nespresso en la encimera...",
        "relevanceScore": 0.94
      }
    ],
    "confidenceScore": 0.94,
    "escalated": false,
    "escalationReason": null
  }
}
```

## 6. Messaging automation request

```json
{
  "touchpointKey": "mtp.day_of_checkin",
  "templateId": "tmpl_123",
  "channelKey": "whatsapp",
  "active": true,
  "triggerType": "reservation_relative",
  "sendOffsetMinutes": -120,
  "timezoneSource": "property_timezone",
  "conditionsJson": {
    "requiresBookedGuestAudience": true
  }
}
```

## 7. Media upload contract

El backend no recibe binarios directamente en el endpoint principal. Flujo:

1. `request-upload`
2. cliente sube a storage
3. `complete-upload` confirma metadata
4. `assign` vincula el asset a la entidad

## 8. Security notes

- no secrets en previews ni drafts por defecto
- no `internal` ni `secret` en guest guide pública
- assistant público solo puede recuperar `public`
