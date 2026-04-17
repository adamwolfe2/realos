# TBGC - Data Model

## Core Tables

### User
Managed by Clerk. Extended in our DB for app-specific fields.

| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | Clerk user ID |
| email | String (unique) | |
| name | String | |
| role | Enum | CLIENT, SALES_REP, OPS, ADMIN |
| organizationId | String? (FK) | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Organization
A client company (restaurant, hotel, etc.)

| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | cuid |
| name | String | Business name |
| tier | Enum | NEW, REPEAT, VIP |
| contactPerson | String | |
| email | String | |
| phone | String | |
| paymentTerms | String | "Net 30", "COD", etc. |
| creditLimit | Decimal? | |
| accountManagerId | String? (FK → User) | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Address
| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | |
| organizationId | String (FK) | |
| type | Enum | BILLING, SHIPPING |
| street | String | |
| city | String | |
| state | String | |
| zip | String | |
| isDefault | Boolean | |

### Product
| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | slug-based |
| name | String | |
| description | String | |
| price | Decimal | Base price |
| unit | String | "per lb", "per oz", etc. |
| category | String | |
| minimumOrder | String? | "4 oz minimum" |
| packaging | String? | |
| available | Boolean | default true |
| marketRate | Boolean | default false (price volatile) |
| prepayRequired | Boolean | default false |
| coldChainRequired | Boolean | default false |
| sortOrder | Int | For display ordering |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Order
| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | "ORD-YYYY-NNNN" format |
| organizationId | String (FK) | |
| userId | String (FK) | Who placed it |
| status | Enum | PENDING, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED |
| subtotal | Decimal | |
| tax | Decimal | |
| total | Decimal | |
| shippingAddressId | String (FK) | |
| notes | String? | |
| stripeSessionId | String? | |
| stripePaymentIntentId | String? | |
| paidAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### OrderItem
| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | |
| orderId | String (FK) | |
| productId | String (FK) | |
| name | String | Snapshot at time of order |
| quantity | Int | |
| unitPrice | Decimal | Snapshot at time of order |
| total | Decimal | |

### Payment
| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | |
| orderId | String (FK) | |
| amount | Decimal | |
| method | Enum | CARD, ACH, WIRE, CHECK |
| status | Enum | PENDING, COMPLETED, FAILED, REFUNDED |
| stripePaymentId | String? | |
| reference | String? | |
| createdAt | DateTime | |

### Invoice
| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | "INV-YYYY-NNNN" |
| orderId | String (FK) | |
| organizationId | String (FK) | |
| dueDate | DateTime | |
| status | Enum | DRAFT, PENDING, PAID, OVERDUE |
| subtotal | Decimal | |
| tax | Decimal | |
| total | Decimal | |
| paidAt | DateTime? | |
| createdAt | DateTime | |

### AuditEvent
| Field | Type | Notes |
|-------|------|-------|
| id | String (PK) | |
| entityType | String | "Order", "Payment", etc. |
| entityId | String | |
| action | String | "created", "status_changed", etc. |
| userId | String? | Who performed it |
| metadata | Json? | Additional context |
| createdAt | DateTime | |

## Relationships

```
Organization 1──∞ User
Organization 1──∞ Address
Organization 1──∞ Order
Organization 1──∞ Invoice
Order 1──∞ OrderItem
Order 1──∞ Payment
Order 1──1 Invoice
OrderItem ∞──1 Product
```

## Indexes

- `Order.organizationId` + `Order.createdAt` (client order listing)
- `Order.status` (ops queue filtering)
- `Product.category` (catalog browsing)
- `Invoice.status` + `Invoice.dueDate` (overdue tracking)
- `AuditEvent.entityType` + `AuditEvent.entityId` (entity history)

## Multi-Tenant Strategy

Organizations are the tenant boundary. All queries filter by `organizationId`. Users belong to one organization. Admin/sales users can access multiple organizations.
