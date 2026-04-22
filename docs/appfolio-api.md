# AppFolio API Reference

> Source: AppFolio Developer Documentation
> Saved: 2026-04-21
> Relevant to: LeaseStack AppFolio integration (lib/integrations/appfolio.ts)

## Key Objects for LeaseStack

| Object | Use in Platform |
|--------|----------------|
| **Listings** | Hourly sync → tenant site unit grid |
| **Properties** | Sync property metadata |
| **Leads** | Push chatbot/form leads into AppFolio |
| **Showings** | Create tour bookings from portal |
| **Tenants** | Occupancy data |
| **Units** | Unit details + rent-ready status |
| **Rental Applications** | Application status tracking |

---

## Attachments

Upload an attachment to a bill, charge, journal entry, occupancy, owner, property, rental application, unit, violation, or work order.

**Attributes**
- `BillId` — The bill to which the file will be attached.
- `ChargeId` — The charge to which the file will be attached.
- `File` — Filename and extension type being attached.
- `JournalEntryId` — The journal entry to which the file will be attached.
- `OccupancyId` — The occupancy to which the file will be attached.
- `OwnerId` — The owner to which the file will be attached.
- `PropertyId` — The property to which the file will be attached.
- `RentalApplicationId` — The rental application to which the file will be attached.
- `UnitId` — Unit to which the file is attached.
- `ViolationId` — The CA violation to which the file will be attached.
- `WorkOrderId` — The work order to which the file will be attached.

---

## Bank Accounts

Returns all bank accounts that meet the filter criteria.

**Attributes**
- `AccountName` — The name of the bank account.
- `BankName` — The name of the bank.
- `Id` — Unique identifier of the bank account.
- `LegalEntityName` — The full legal name given to the business or individual owning the bank account.

---

## Bills

Get a bill, create a bill, bulk create bills, or update a bill.

**Attributes**
- `AccountNumber` — For utility billing. The account number associated with the bill.
- `ApprovalStatus` — Indicates the bill's approval status.
- `CheckMemo` — The memo on the check.
- `DueDate` — The date the bill is due.
- `Id` — Unique identifier of the bill.
- `InvoiceDate` — The date the invoice was received.
- `LastUpdatedAt` — The date the bill was last updated.
- `LineItems` — An array of the bill's line items.
- `ManagementCompanyAsPayee` — Indicates whether the management company is the payee.
- `PropertyId` — Unique identifier of the property associated with the bill.
- `PostingDate` — Accrual-accounting invoice date.
- `Reference` — Invoice number of the bill.
- `Remarks` — A description or summary of the invoice.
- `TotalAmount` — Total amount of the bill.
- `VendorId` — Unique identifier for the payee's vendor.
- `WorkOrderId` — Unique identifier of the work order corresponding to the invoice.

---

## Charges

Get all open charges for occupants residing at a specific property, create a charge, or bulk create charges.

**Attributes**
- `Id` — Unique identifier of the charge.
- `AmountDue` — Current outstanding charges and/or future charges not yet paid.
- `ChargedOn` — All current outstanding charges with amounts and charged on date(s).
- `Description` — Brief description of the charge.
- `GlAccountId` — Unique identifier of the general ledger account associated with the charge(s).
- `OccupancyId` — Unique identifier of the occupancy associated with the charge.

---

## Leads ⭐ (Push chatbot leads here)

Get, create and update leads.

**Attributes**
- `Id` — Unique identifier for the lead.
- `PropertyIds` — Unique identifier of the property associated with the lead.
- `LastUpdatedAt` — Returns lead records updated since the date provided.
- `FirstName` — First name of the prospective resident.
- `LastName` — Last name of the prospective resident.
- `PropertyId` — Unique identifier for the property associated with the lead.
- `AdditionalOccupants` — Number of other potential occupants.
- `Bathrooms` — Number of bathrooms the prospective resident desires.
- `Bedrooms` — Number of bedrooms the prospective resident desires.
- `CreatedAt` — Date the inquiry was created.
- `CreditScore` — Self-reported credit score of the prospective resident.
- `DesiredMovein` — Desired move-in date.
- `Email` — Email address of the prospective resident.
- `HasCats` — Whether or not the prospective resident has a cat(s).
- `HasDogs` — Whether or not the prospective resident has a dog(s).
- `HasOtherPet` — Whether or not the prospective resident has other pet(s).
- `MaxRent` — Max amount willing to pay per month.
- `MiddleInitial` — Middle initial.
- `MonthlyIncome` — Self-reported monthly income.
- `PhoneNumber` — Phone number.
- `Source` — Mechanism through which the prospective resident submitted the inquiry.
- `Status` — The status of the lead.
- `UnitIds` — Unique identifier of the unit the prospective resident inquired into.
- `LeadId` — Unique identifier of the lead to update.

---

## Listings ⭐ (Hourly sync for tenant site)

Get all listings that meet the filter criteria.

**Attributes**
- `Id` — Unique identifier of the listing.
- `Address1` — The primary street address.
- `Address2` — Additional street address information.
- `AdvertisedRent` — The rent per month as advertised.
- `ApplicationFee` — The Application Fee amount.
- `ApplicationURL` — The URL link to the application page.
- `AvailableOn` — The date upon which the listing can be leased.
- `Bathrooms` — The number of bathrooms.
- `Bedrooms` — The number of bedrooms.
- `CatsAllowed` — Whether or not the listing allows cats.
- `City` — The city where the listing is located.
- `Deposit` — The security, rent, or pet and cleaning deposit amount.
- `DogPolicy` — Whether or not the listing allows dogs.
- `IsCampaign` — Whether or not the listing is part of a campaign.
- `LastUpdatedAt` — The last time the listing was updated.
- `MarketingDescription` — A description of the listing for syndication.
- `MarketingTitle` — The title of the listing for syndication.
- `PropertyId` — Unique identifier of the property.
- `PropertyMarketingDescription` — The title of the property for syndication.
- `SquareFeet` — The size of the listing in square feet.
- `State` — The state where the listing is located.
- `UnitAmenities` — The amenities offered by the building.
- `UnitId` — Unique identifier of the unit.
- `UnitPhotos` — Photos of the listing.
- `UnitType` — The floor plan of the listing.
- `UtilitiesIncluded` — The utilities which are included with rent.
- `YouTubeURL` — The URL of the YouTube video for the listing.
- `Zip` — The zip code.

---

## Properties ⭐ (Sync property metadata)

Get all properties that meet the filter criteria.

**Attributes**
- `Id` — Unique identifier of the properties.
- `LastUpdatedAtFrom` — Returns property records updated since the date provided.
- `IncludeHidden` — Whether or not to include hidden properties.
- `Address1` — Primary street address.
- `Address2` — Additional street address information.
- `City` — City where the property is located.
- `HiddenAt` — When the property was labeled no longer active.
- `LastUpdatedAt` — The last time the property was updated.
- `MaintenanceNotes` — A brief informative message about maintenance.
- `Name` — The name of the property.
- `PropertyGroupIds` — A list of property group IDs that the property belongs to.
- `PropertyType` — The type of property (Single-family, HOA, etc.).
- `State` — State where the property is located.
- `TenantPortalLink` — Link to direct a resident to their resident portal.
- `Zip` — Zip code.

---

## Showings ⭐ (Create tour bookings)

Create and update showings.

**Attributes**
- `EndAt` — End time of the showing.
- `StartAt` — Start time of the showing.
- `LeadId` — Unique identifier of the lead associated with the showing.
- `UnitId` — Unique identifier of the unit to be shown.
- `AssignedUserId` — Unique identifier of the AppFolio user responsible.
- `Notes` — A brief informative message about the showing.
- `Status` — Current status (scheduled, canceled, etc.).
- `ShowingId` — Unique identifier for the showing to update.

---

## Tenants

Get all tenants.

**Attributes**
- `Id` — Unique identifier of the tenant.
- `OccupancyId` — Unique identifier of an occupancy.
- `UnitId` — The unit the tenant occupies.
- `PropertyId` — The property with the unit.
- `FirstName` — The tenant's first name.
- `LastName` — The tenant's last name.
- `Link` — A link to the tenant's page in AppFolio.
- `CompanyName` — The display name of the tenant's company.
- `Status` — The status of the tenant.
- `PhoneNumber` — The tenant's phone number.
- `Email` — The tenant's email address.
- `MoveInOn` — The tenant started, or will begin occupancy.
- `MoveOutOn` — The date the tenant ended, or will end occupancy.
- `RentalApplicationId` — Unique identifier of the tenant-submitted rental application.
- `TenantType` — The type of tenant.
- `PrimaryTenant` — Whether or not the tenant is the primary leaseholder.
- `LeaseSignedDate` — The date the lease was executed.
- `LeaseStartDate` — The day the lease agreement starts.
- `LeaseEndDate` — The last day of the lease agreement.
- `HiddenAt` — When the tenant was placed into an inactive state.
- `LastUpdatedAt` — The last time the tenant's information was updated.

---

## Units ⭐

Get and update units.

**Attributes**
- `Id` — Unique identifier of the unit(s).
- `PropertyIds` — Unique identifier of the property the unit belongs to.
- `UnitGroupIds` — Unique identifier of the unit group.
- `LeasingType` — The type of lease (bed unit, etc.).
- `LastUpdatedAtFrom` — Returns unit records updated since the date provided.
- `IncludeHidden` — Whether or not to include hidden units.
- `UnitId` — The unique identifier of the unit to update.
- `RentReady` — Whether or not the unit is ready to be occupied.

---

## Rental Applications

Get all rental applications that meet the filter criteria.

**Attributes**
- `Id` — Unique identifier of the rental application.
- `CampaignId` — Unique identifier of the campaign.
- `GroupId` — Unique identifier of the group.
- `UnitId` — Unique identifier of the unit.
- `Bedrooms` — The number of desired bedrooms.
- `Bathrooms` — The number of desired bathrooms.
- `Deposit` — The security deposit amount.
- `ListedMarketRent` — The rent per month as listed.
- `Status` — The rental application's status.
- `SubmittedAt` — The date and time the application was submitted.
- `DesiredMoveInDate` — The date the applicant would like to move in.
- `Applicant` — The applicant's details.

---

## Users

Get all AppFolio Property Manager users that meet the filter criteria.

**Attributes**
- `PropertyId` — Unique identifier of the property.
- `LastUpdatedAtFrom` — Returns user records updated since the date provided.
- `Id` — Unique identifier of an AppFolio user.
- `Email` — The user's email address.
- `FirstName` — The first name.
- `LastName` — The last name.
- `UserRole` — The system role assigned to the user.
- `LastUpdatedAt` — The last time the user's information was updated.

---

## Vendors

Get, create or update vendors.

**Attributes**
- `Id` — Unique identifier of the vendor.
- `LastUpdatedAtFrom` — Returns vendor records updated since the date provided.
- `IncludeHidden` — Whether or not to include hidden vendors.
- `IsCompany` — Whether or not the vendor is a company.
- `TaxpayerName` — The taxpayer name.
- `TaxpayerId` — The vendor's taxpayer identification.
- `CompanyName` — Optional display name.
- `FirstName` / `LastName` — Vendor contact name.
- `Address1`, `Address2`, `City`, `State`, `Zip` — Address.
- `PhoneNumber` / `Email` — Contact info.
- `CompanyURL` — Vendor's website.
- `LiabilityInsuranceExpiration` — Expiration of liability insurance.
- `CompliantStatus` — Whether or not the vendor meets compliance.
- `VendorId` — Unique identifier to update.

---

## Work Orders

Get, create or update work orders for a property, unit, or occupancy.

**Attributes**
- `Id` — Unique identifier of the work order.
- `PropertyId` — Unique identifier of the property.
- `UnitId` — Unique identifier of the unit.
- `Statuses` — The status of the work order.
- `LastUpdatedAtFrom` — Returns work orders updated since the date provided.
- `JobDescription` — A brief description of the work order.
- `AssignedUsers` — AppFolio user assigned.
- `CanceledOn` / `CompletedOn` — Status change timestamps.
- `PermissionToEnter` — Whether permission has been granted.
- `Priority` — The priority (urgent, etc.).
- `ScheduledStart` / `ScheduledEnd` — Projected start/end.
- `Status` — Current status.
- `VendorId` — Unique identifier of the vendor.
- `VendorTrade` — The type of service offered.

---

## OAuth / Partner Access

To use the AppFolio API, LeaseStack must be an approved API partner.

**Apply at:** https://www.appfolio.com/partners/api
**Required:** Company info, use case description, data handling practices
**Credentials:** OAuth 2.0 client ID + secret (stored encrypted in `AppFolioIntegration` table)
**Env vars:** `APPFOLIO_OAUTH_CLIENT_ID`, `APPFOLIO_OAUTH_CLIENT_SECRET`
**OAuth flow:** `/api/oauth/appfolio` → `/api/oauth/appfolio/callback`
