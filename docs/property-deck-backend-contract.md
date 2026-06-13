# Property Deck Backend Contract

This is the API and SQL shape the frontend now calls from `services/PropertyDeckService.js`.

The frontend uses these routes first and falls back to local storage only while the backend is not implemented.

## Tables

This SQL is written for SQL Server. Adjust `UserID` and `ListingID` column types if your existing `Users` or `RealEstateListing` IDs use a stricter type.

```sql
CREATE TABLE PropertyDeck (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    UserID NVARCHAR(64) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    FilterJson NVARCHAR(MAX) NULL,
    DeckStatus NVARCHAR(24) NOT NULL CONSTRAINT DF_PropertyDeck_Status DEFAULT 'active',
    DeletedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyDeck_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyDeck_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_PropertyDeck_Status
        CHECK (DeckStatus IN ('active', 'deleted'))
);

CREATE INDEX IX_PropertyDeck_UserID ON PropertyDeck(UserID);
CREATE INDEX IX_PropertyDeck_UserID_Status ON PropertyDeck(UserID, DeckStatus);

CREATE TABLE PropertyDeckListing (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    PropertyDeckID INT NOT NULL,
    ListingID NVARCHAR(64) NOT NULL,
    MatchScore DECIMAL(6,2) NULL,
    [Rank] INT NULL,
    SearchDistanceMiles DECIMAL(8,3) NULL,
    [Status] NVARCHAR(24) NOT NULL CONSTRAINT DF_PropertyDeckListing_Status DEFAULT 'matched',
    ProsJson NVARCHAR(MAX) NULL,
    ConsJson NVARCHAR(MAX) NULL,
    MetricsJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyDeckListing_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_PropertyDeckListing_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PropertyDeckListing_PropertyDeck
        FOREIGN KEY (PropertyDeckID) REFERENCES PropertyDeck(ID) ON DELETE CASCADE,
    CONSTRAINT UQ_PropertyDeckListing_Deck_Listing
        UNIQUE (PropertyDeckID, ListingID),
    CONSTRAINT CK_PropertyDeckListing_Status
        CHECK ([Status] IN ('matched', 'shortlisted', 'skipped', 'hidden', 'archived'))
);

CREATE INDEX IX_PropertyDeckListing_Deck_Status_Rank
    ON PropertyDeckListing(PropertyDeckID, [Status], [Rank]);

CREATE INDEX IX_PropertyDeckListing_ListingID
    ON PropertyDeckListing(ListingID);

CREATE TABLE ShortList (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    UserID NVARCHAR(64) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    SourcePropertyDeckID INT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ShortList_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ShortList_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ShortList_SourcePropertyDeck
        FOREIGN KEY (SourcePropertyDeckID) REFERENCES PropertyDeck(ID)
);

CREATE INDEX IX_ShortList_UserID ON ShortList(UserID);

CREATE TABLE ShortListListing (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    ShortListID INT NOT NULL,
    ListingID NVARCHAR(64) NOT NULL,
    UserID NVARCHAR(64) NOT NULL,
    SourcePropertyDeckID INT NULL,
    SourcePropertyDeckListingID INT NULL,
    Notes NVARCHAR(MAX) NULL,
    [Rank] INT NULL,
    FavoriteLevel INT NOT NULL CONSTRAINT DF_ShortListListing_FavoriteLevel DEFAULT 1,
    ViewedAt DATETIME2 NULL,
    AddedAt DATETIME2 NOT NULL CONSTRAINT DF_ShortListListing_AddedAt DEFAULT SYSUTCDATETIME(),
    RemovedAt DATETIME2 NULL,
    Active BIT NOT NULL CONSTRAINT DF_ShortListListing_Active DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ShortListListing_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ShortListListing_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ShortListListing_ShortList
        FOREIGN KEY (ShortListID) REFERENCES ShortList(ID) ON DELETE CASCADE,
    CONSTRAINT FK_ShortListListing_SourcePropertyDeck
        FOREIGN KEY (SourcePropertyDeckID) REFERENCES PropertyDeck(ID),
    CONSTRAINT FK_ShortListListing_SourcePropertyDeckListing
        FOREIGN KEY (SourcePropertyDeckListingID) REFERENCES PropertyDeckListing(ID),
    CONSTRAINT UQ_ShortListListing_Active_User_Listing
        UNIQUE (UserID, ListingID, Active)
);

CREATE INDEX IX_ShortListListing_ShortList_Active_Rank
    ON ShortListListing(ShortListID, Active, [Rank]);

CREATE INDEX IX_ShortListListing_UserID_ListingID
    ON ShortListListing(UserID, ListingID);

CREATE TABLE ComparisonBoard (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    UserID NVARCHAR(64) NOT NULL,
    PropertyDeckID INT NOT NULL,
    ShortListID INT NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    BoardStatus NVARCHAR(24) NOT NULL CONSTRAINT DF_ComparisonBoard_Status DEFAULT 'active',
    SummaryJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ComparisonBoard_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ComparisonBoard_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ComparisonBoard_PropertyDeck
        FOREIGN KEY (PropertyDeckID) REFERENCES PropertyDeck(ID) ON DELETE CASCADE,
    CONSTRAINT FK_ComparisonBoard_ShortList
        FOREIGN KEY (ShortListID) REFERENCES ShortList(ID),
    CONSTRAINT CK_ComparisonBoard_Status
        CHECK (BoardStatus IN ('active', 'archived', 'completed'))
);

CREATE UNIQUE INDEX UX_ComparisonBoard_Deck_ShortList_Active
    ON ComparisonBoard(PropertyDeckID, ShortListID, BoardStatus)
    WHERE BoardStatus = 'active';

CREATE INDEX IX_ComparisonBoard_UserID ON ComparisonBoard(UserID);

CREATE TABLE ComparisonBoardListing (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    ComparisonBoardID INT NOT NULL,
    ShortListListingID INT NOT NULL,
    ListingID NVARCHAR(64) NOT NULL,
    GeneralPropertyRating DECIMAL(6,2) NULL,
    UserPropertyRating DECIMAL(6,2) NULL,
    BoardRank INT NULL,
    ProsJson NVARCHAR(MAX) NULL,
    ConsJson NVARCHAR(MAX) NULL,
    MetricsJson NVARCHAR(MAX) NULL,
    AiSummary NVARCHAR(MAX) NULL,
    Active BIT NOT NULL CONSTRAINT DF_ComparisonBoardListing_Active DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ComparisonBoardListing_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ComparisonBoardListing_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ComparisonBoardListing_Board
        FOREIGN KEY (ComparisonBoardID) REFERENCES ComparisonBoard(ID) ON DELETE CASCADE,
    CONSTRAINT FK_ComparisonBoardListing_ShortListListing
        FOREIGN KEY (ShortListListingID) REFERENCES ShortListListing(ID),
    CONSTRAINT UQ_ComparisonBoardListing_Board_Listing
        UNIQUE (ComparisonBoardID, ListingID)
);

CREATE INDEX IX_ComparisonBoardListing_Board_Active_Rank
    ON ComparisonBoardListing(ComparisonBoardID, Active, BoardRank);

CREATE TABLE ComparisonBoardPair (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    ComparisonBoardID INT NOT NULL,
    LeftComparisonBoardListingID INT NOT NULL,
    RightComparisonBoardListingID INT NOT NULL,
    WinnerComparisonBoardListingID INT NULL,
    ComparisonJson NVARCHAR(MAX) NULL,
    ProsConsJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ComparisonBoardPair_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ComparisonBoardPair_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ComparisonBoardPair_Board
        FOREIGN KEY (ComparisonBoardID) REFERENCES ComparisonBoard(ID) ON DELETE CASCADE,
    CONSTRAINT FK_ComparisonBoardPair_LeftListing
        FOREIGN KEY (LeftComparisonBoardListingID) REFERENCES ComparisonBoardListing(ID),
    CONSTRAINT FK_ComparisonBoardPair_RightListing
        FOREIGN KEY (RightComparisonBoardListingID) REFERENCES ComparisonBoardListing(ID),
    CONSTRAINT FK_ComparisonBoardPair_WinnerListing
        FOREIGN KEY (WinnerComparisonBoardListingID) REFERENCES ComparisonBoardListing(ID)
);

CREATE INDEX IX_ComparisonBoardPair_Board
    ON ComparisonBoardPair(ComparisonBoardID);
```

Recommended behavior:

- Create one default `ShortList` per `PropertyDeck`, using the deck name.
- Use `PropertyDeckListing.Status = 'matched'` for items still in the swipe deck.
- When user swipes right, upsert active `ShortListListing` and set `PropertyDeckListing.Status = 'shortlisted'`.
- When user swipes left, set `PropertyDeckListing.Status = 'skipped'`.
- If a shortlist item is removed, set `Active = 0`, `RemovedAt = SYSUTCDATETIME()`, and set deck listing status back to `matched` if you want it to reappear.
- Create one active `ComparisonBoard` per `PropertyDeck` + `ShortList` when the user opens the Decider Board.
- Populate `ComparisonBoardListing` from active `ShortListListing` rows. Keep `GeneralPropertyRating`, `UserPropertyRating`, `BoardRank`, `ProsJson`, `ConsJson`, and `MetricsJson` here so the board remains stable even if source listing data changes later.
- Store head-to-head AI output in `ComparisonBoardPair` when the user compares two listings.

## Migration Deltas For Existing Implementations

If `PropertyDeck`, `PropertyDeckListing`, `ShortList`, and `ShortListListing` already exist from the earlier contract, the split into Deck -> Shortlist -> Board only needs these additions.

```sql
ALTER TABLE PropertyDeckListing
ADD SearchDistanceMiles DECIMAL(8,3) NULL;

ALTER TABLE PropertyDeck
ADD DeckStatus NVARCHAR(24) NOT NULL
    CONSTRAINT DF_PropertyDeck_Status DEFAULT 'active',
    DeletedAt DATETIME2 NULL;

ALTER TABLE PropertyDeck
ADD CONSTRAINT CK_PropertyDeck_Status
    CHECK (DeckStatus IN ('active', 'deleted'));

-- Then create ComparisonBoard, ComparisonBoardListing, and ComparisonBoardPair from the table definitions above.
```

The existing deck/shortlist split does not need to be redesigned. The Shortlist screen is now a review/thinning step, but it still maps cleanly to `ShortList` and `ShortListListing`.

## Frontend API Calls

All routes should require the logged-in user from the bearer token. The frontend still sends API key headers through `services/api.js`.

### List Decks

`GET /api/property-decks?includeDeleted=true`

The Property Deck tab requests deleted decks too so it can show the `Deleted Property Decks` section. Soft-deleted decks should still count against the user's deck limit until permanently destroyed.

Response:

```json
{
  "decks": [
    {
      "id": "12",
      "name": "Hunter's for-sale house London",
      "filterJson": {
        "listingType": "for-sale",
        "propertyType": "house",
        "city": "London"
      },
      "deckStatus": "active",
      "isDeleted": false,
      "deletedAt": null,
      "createdAt": "2026-06-06T12:00:00.000Z",
      "updatedAt": "2026-06-06T12:00:00.000Z",
      "shortlistCount": 3,
      "deckListingCount": 42
    }
  ]
}
```

### Create Deck

`POST /api/property-decks`

Request:

```json
{
  "name": "Hunter's for-sale house London",
  "filterJson": {
    "listingType": "for-sale",
    "propertyType": "house",
    "city": "London"
  }
}
```

Response:

```json
{
  "deck": {
    "id": "12",
    "name": "Hunter's for-sale house London",
    "filterJson": {},
    "createdAt": "2026-06-06T12:00:00.000Z",
    "updatedAt": "2026-06-06T12:00:00.000Z",
    "shortlistCount": 0,
    "deckListingCount": 0
  }
}
```

Backend should enforce limits:

- `free`: 0 decks
- `prospector`: 1 deck
- `investor`: 5 decks
- `developer`: 10 decks

### Create Deck From Current Map Listings

`POST /api/property-decks/from-listings`

The MapView calls this when the user presses `Create Property Deck`. The backend should create one `PropertyDeck` row and one `PropertyDeckListing` row for each listing in the request.

Request:

```json
{
  "name": "Hunter's for-sale house London",
  "filterJson": {
    "listingType": "for-sale",
    "radiusKm": 5,
    "minPrice": "0",
    "maxPrice": "400000",
    "beds": null,
    "baths": null,
    "latitude": 51.5,
    "longitude": -0.12
  },
  "listingIds": ["5501"],
  "listings": [
    {
      "listingId": "5501",
      "ListingID": "5501",
      "distanceMiles": 0.5,
      "DistanceMiles": 0.5,
      "searchDistanceMiles": 0.5,
      "SearchDistanceMiles": 0.5,
      "rank": 1,
      "Rank": 1,
      "status": "matched",
      "Status": "matched"
    }
  ]
}
```

The backend should use `listings[].listingId` or `listings[].ListingID` as the source of `PropertyDeckListing.ListingID`. The `listingIds` array is a convenience duplicate for simpler insert loops. Do not require full listing objects in this bulk request; the payload can contain 100+ map listings and should stay small.

Required behavior:

- Insert one `PropertyDeck` row.
- Insert one `PropertyDeckListing` row for every valid listing ID sent.
- Set `PropertyDeckListing.PropertyDeckID` to the created deck ID.
- Set `PropertyDeckListing.ListingID` to the listing ID.
- Set `Status = 'matched'`.
- Preserve `Rank`, `SearchDistanceMiles`, and `DistanceMiles` if present.

Response:

```json
{
  "deck": {
    "id": "12",
    "name": "Hunter's for-sale house London",
    "filterJson": {},
    "createdAt": "2026-06-06T12:00:00.000Z",
    "updatedAt": "2026-06-06T12:00:00.000Z",
    "shortlistCount": 0,
    "deckListingCount": 42
  }
}
```

### Rename, Delete, Or Restore Deck

`PATCH /api/property-decks/:deckId`

Rename request:

```json
{
  "name": "Edited deck name"
}
```

Soft-delete request:

```json
{
  "deckStatus": "deleted",
  "isDeleted": true,
  "deletedAt": "2026-06-10T12:00:00.000Z"
}
```

Restore request:

```json
{
  "deckStatus": "active",
  "isDeleted": false,
  "deletedAt": null
}
```

Soft delete should set `PropertyDeck.DeckStatus = 'deleted'` and `DeletedAt = SYSUTCDATETIME()`. It should not hard-delete `PropertyDeckListing`, `ShortList`, `ShortListListing`, `ComparisonBoard`, or board edits. Restore should set `DeckStatus = 'active'` and `DeletedAt = NULL`.

Response can be:

```json
{
  "success": true
}
```

### Destroy Deck

`DELETE /api/property-decks/:deckId?destroy=true`

This is only called from the Deleted Property Decks section. It should permanently remove the deck so the user frees one of their tier-limited deck slots.

Recommended transactional delete order:

1. Delete `ComparisonBoardPair` rows for boards belonging to the deck.
2. Delete `ComparisonBoardListing` rows for boards belonging to the deck.
3. Delete `ComparisonBoard` rows for the deck.
4. Delete `ShortListListing` rows for shortlists with `SourcePropertyDeckID = :deckId`.
5. Delete `ShortList` rows with `SourcePropertyDeckID = :deckId`.
6. Delete `PropertyDeckListing` rows for the deck.
7. Delete the `PropertyDeck` row.

Response:

```json
{
  "success": true
}
```

### Get Deck Listings

`GET /api/property-decks/:deckId/listings?status=matched`

Response:

```json
{
  "listings": [
    {
      "propertyDeckListingId": "101",
      "listingId": "5501",
      "status": "matched",
      "matchScore": 87.5,
      "rank": 1,
      "distanceMiles": 0.5,
      "searchDistanceMiles": 0.5,
      "prosJson": ["Good schools", "Below area average"],
      "consJson": ["Longer commute"],
      "metricsJson": {
        "distanceScore": 87,
        "priceScore": 74,
        "schoolScore": 92
      },
      "listing": {
        "ID": "5501",
        "Title": "3 bed house",
        "Price": "£450,000",
        "Beds": 3,
        "Baths": 2,
        "PropertyType": "House",
        "ImageUrls": []
      }
    }
  ]
}
```

The frontend accepts either nested `listing` or flat listing fields.

### Shortlist Listing

`POST /api/property-decks/:deckId/shortlist`

Request:

```json
{
  "listingId": "5501",
  "sourcePropertyDeckListingId": "101"
}
```

Response:

```json
{
  "shortlist": [
    {
      "shortListListingId": "44",
      "listingId": "5501",
      "sourcePropertyDeckID": "12",
      "sourcePropertyDeckListingID": "101",
      "listing": {
        "ID": "5501",
        "Title": "3 bed house",
        "Price": "£450,000"
      }
    }
  ]
}
```

### Get Shortlist

`GET /api/property-decks/:deckId/shortlist`

Response:

```json
{
  "shortlist": [
    {
      "shortListListingId": "44",
      "listingId": "5501",
      "notes": null,
      "rank": 1,
      "generalPropertyRating": 82,
      "userPropertyRating": 91,
      "distanceMiles": 0.5,
      "favoriteLevel": 1,
      "active": true,
      "listing": {
        "ID": "5501",
        "Title": "3 bed house",
        "Price": "£450,000",
        "ImageUrls": []
      }
    }
  ]
}
```

### Skip Deck Listing

`PATCH /api/property-decks/:deckId/listings/:listingId`

Request:

```json
{
  "status": "skipped"
}
```

Response:

```json
{
  "success": true
}
```

### Remove From Shortlist

`DELETE /api/property-decks/:deckId/shortlist/:listingId`

Response:

```json
{
  "shortlist": []
}
```

## Comparison Board API Calls

The Decider Board is the third step after Deck swipe and Shortlist review. It should be persisted separately because the board can contain AI-generated ratings, ranking, pros/cons, and head-to-head comparisons that should not be lost when source listing data changes.

### Get Or Create Comparison Board

`POST /api/property-decks/:deckId/comparison-board`

Backend behavior:

- Find the deck's active shortlist.
- Find or create one active `ComparisonBoard` for `PropertyDeckID + ShortListID`.
- Upsert active `ComparisonBoardListing` rows from active `ShortListListing` rows.
- Calculate or preserve `GeneralPropertyRating`, `UserPropertyRating`, `BoardRank`, `ProsJson`, `ConsJson`, and `MetricsJson`.

Request can be empty:

```json
{}
```

Optional request if frontend/backend wants to pass current fallback scores:

```json
{
  "listings": [
    {
      "listingId": "5501",
      "shortListListingId": "44",
      "generalPropertyRating": 82,
      "userPropertyRating": 91,
      "boardRank": 1,
      "prosJson": ["Good schools", "Below area average"],
      "consJson": ["Longer commute"],
      "metricsJson": {
        "distanceScore": 87,
        "priceScore": 74
      }
    }
  ]
}
```

Response:

```json
{
  "board": {
    "id": "31",
    "propertyDeckId": "12",
    "shortListId": "8",
    "name": "Hunter's for-sale house London Board",
    "boardStatus": "active",
    "summaryJson": null,
    "createdAt": "2026-06-09T12:00:00.000Z",
    "updatedAt": "2026-06-09T12:00:00.000Z",
    "listings": [
      {
        "comparisonBoardListingId": "77",
        "shortListListingId": "44",
        "listingId": "5501",
        "generalPropertyRating": 82,
        "userPropertyRating": 91,
        "boardRank": 1,
        "prosJson": ["Good schools", "Below area average"],
        "consJson": ["Longer commute"],
        "metricsJson": {
          "distanceScore": 87,
          "priceScore": 74
        },
        "aiSummary": "Strong fit for the current search profile.",
        "listing": {
          "ID": "5501",
          "Title": "3 bed house",
          "Price": "£450,000",
          "ImageUrls": []
        }
      }
    ]
  }
}
```

### Get Comparison Board

`GET /api/property-decks/:deckId/comparison-board`

Returns the same shape as `POST /api/property-decks/:deckId/comparison-board`, without creating rows if the backend wants strict read behavior. If no board exists, return `404` or `{ "board": null }`.

### Update Board Listing

`PATCH /api/comparison-boards/:boardId/listings/:listingId`

Used for manual thinning, re-ranking, or storing refreshed AI scores.

Request:

```json
{
  "active": true,
  "boardRank": 2,
  "generalPropertyRating": 84,
  "userPropertyRating": 88,
  "prosJson": ["Good rental demand"],
  "consJson": ["Needs renovation"],
  "metricsJson": {
    "yieldScore": 79,
    "conditionScore": 62
  },
  "aiSummary": "Better upside, but more work required."
}
```

Response:

```json
{
  "success": true
}
```

### Remove Board Listing

`DELETE /api/comparison-boards/:boardId/listings/:listingId`

Recommended behavior:

- Set `ComparisonBoardListing.Active = 0`.
- Do not remove the underlying `ShortListListing` unless the frontend explicitly calls the shortlist delete route.

Response:

```json
{
  "success": true
}
```

### Create Or Update Head-To-Head Comparison

`POST /api/comparison-boards/:boardId/compare`

Request:

```json
{
  "leftComparisonBoardListingId": "77",
  "rightComparisonBoardListingId": "78"
}
```

Response:

```json
{
  "comparison": {
    "id": "14",
    "boardId": "31",
    "leftComparisonBoardListingId": "77",
    "rightComparisonBoardListingId": "78",
    "winnerComparisonBoardListingId": "77",
    "comparisonJson": {
      "summary": "Candidate A is the stronger fit for this user profile.",
      "categories": [
        {
          "label": "Location fit",
          "leftScore": 91,
          "rightScore": 84
        },
        {
          "label": "Value",
          "leftScore": 78,
          "rightScore": 86
        }
      ]
    },
    "prosConsJson": {
      "left": {
        "pros": ["Closer to search location", "Better user fit"],
        "cons": ["Higher price"]
      },
      "right": {
        "pros": ["Lower price"],
        "cons": ["Weaker location fit"]
      }
    }
  }
}
```

### Archive Comparison Board

`PATCH /api/comparison-boards/:boardId`

Request:

```json
{
  "boardStatus": "archived"
}
```

Response:

```json
{
  "success": true
}
```
