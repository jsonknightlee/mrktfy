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

## Property Ranking Architecture Handoff

The frontend flow is now intentionally split into three stages. Backend implementation should keep the existing endpoint and relationship structure, but move ranking responsibility to the correct layer.

### Stage 1: Property Deck = Discovery Mode

Purpose:

```text
Show -> Skip -> Shortlist
```

The deck should stay fast. It exists to track swipe/discovery state only.

Users make quick decisions from:

- Photos
- Price
- Bedrooms
- Bathrooms
- Distance from search location
- Property type

Recommended `PropertyDeckListing` responsibility:

```sql
PropertyDeckListing
- ID
- PropertyDeckID
- ListingID
- MatchScore NULL -- keep nullable/backward compatible; do not calculate here yet
- SearchDistanceMiles / DistanceKm
- Status -- matched/pending, skipped, shortlisted, hidden, archived
- ViewedAt NULL
- CreatedAt
- UpdatedAt
```

Notes:

- Keep `PropertyDeckListing` lightweight.
- Do not create new pros/cons here.
- Do not create detailed metrics here.
- Existing nullable `ProsJson`, `ConsJson`, and `MetricsJson` columns can remain for backward compatibility, but new discovery writes should leave them null.
- Current frontend status names are `matched`, `skipped`, and `shortlisted`. If backend internally prefers `pending`, treat `pending` and `matched` as equivalent for active swipe candidates.

### Stage 2: Shortlist = Intelligence Mode

Purpose:

```text
Rank properties
Calculate user fit
Explain why properties rank highly
```

Once a listing is shortlisted, backend should begin deeper scoring. This is the correct place for rank and fit calculations because the user has already shown intent.

Recommended `ShortListListing` additions:

```sql
ALTER TABLE ShortListListing
ADD PropertyRank INT NULL,
    YourFitRank INT NULL,
    MatchScore DECIMAL(6,2) NULL,
    PriceScore DECIMAL(6,2) NULL,
    LocationScore DECIMAL(6,2) NULL,
    LifestyleScore DECIMAL(6,2) NULL,
    InvestmentScore DECIMAL(6,2) NULL,
    RiskScore DECIMAL(6,2) NULL,
    ScoreBreakdownJson NVARCHAR(MAX) NULL;
```

These can coexist with the existing `[Rank]` and `FavoriteLevel` columns. For compatibility:

- `[Rank]` can continue to represent the current visible shortlist order.
- `PropertyRank` should represent objective market/property quality.
- `YourFitRank` should represent suitability for this specific user.
- `MatchScore` should be the weighted user-intent score.
- `ScoreBreakdownJson` should store the detailed score inputs and explanation used to produce the rankings.

#### PropertyRank

`PropertyRank` answers:

```text
How good is this property objectively?
```

Possible inputs:

- Price competitiveness
- Size
- Rooms
- Location
- Yield
- Risk
- Growth potential

Example:

```text
PropertyRank #1 = Best overall property
PropertyRank #2 = Second best
PropertyRank #3 = Third best
```

#### YourFitRank

`YourFitRank` answers:

```text
How suitable is this property for THIS user?
```

Possible inputs from onboarding/search profile:

- Budget
- Family size
- Bedrooms required
- School priorities
- Commute preferences
- Investment goals
- Renovation interest
- Retirement plans

Example:

```text
Property A = PropertyRank #7
Property A = YourFitRank #1
```

This means it may not be the best property overall, but it is the strongest fit for this user.

### Stage 3: Compare Board = Analysis Mode

Purpose:

```text
Deep comparison
Pros and cons
Head-to-head decision support
```

The compare board is where expensive, detailed comparison belongs. It should help the user compare shortlisted properties, but it should not own the final purchase/rental journey, documents, viewing notes, or final process status.

Recommended `ComparisonBoardListing` responsibility:

```sql
ComparisonBoardListing
- ID
- ComparisonBoardID
- ShortListListingID
- ListingID
- ProsJson
- ConsJson
- MetricsJson
- UserNotes
- SortOrder / BoardRank
- CreatedAt
- UpdatedAt
```

Existing `BoardRank` can be treated as `SortOrder`. Add these nullable fields if they do not already exist:

```sql
ALTER TABLE ComparisonBoardListing
ADD UserNotes NVARCHAR(MAX) NULL,
    SortOrder INT NULL;
```

Backend can keep `GeneralPropertyRating`, `UserPropertyRating`, and `BoardRank` for compatibility with the current frontend. If `SortOrder` is added, keep it synchronized with `BoardRank` until the frontend moves fully to `SortOrder`.

Examples of board-level output:

```text
Pros:
- Large garden
- Excellent schools
- Recently renovated

Cons:
- Smaller kitchen
- Higher council tax
```

### Stage 4: DecisionBoard = Property Journey & Decision Mode

Purpose:

```text
Document the user's chosen-property journey
Track real-world progress
Store personal notes, media, and process updates
Support optional sharing inside the app
```

The DecisionBoard is distinct from the ComparisonBoard. The ComparisonBoard helps users compare properties. The DecisionBoard begins once the user has actively chosen to pursue a property and needs an ongoing workspace.

This is where `UserVerdict`, progress tracking, documents, personal media, tasks, and timeline events belong.

Recommended new tables:

```sql
CREATE TABLE DecisionBoard (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    UserID NVARCHAR(64) NOT NULL,
    ListingID NVARCHAR(64) NOT NULL,
    ShortListID INT NULL,
    ComparisonBoardID INT NULL,

    DecisionStatus NVARCHAR(60) NOT NULL CONSTRAINT DF_DecisionBoard_Status DEFAULT 'Interested',
    UserVerdict NVARCHAR(40) NULL,
    ProgressPercent INT NULL,
    CurrentStage NVARCHAR(80) NULL,
    Notes NVARCHAR(MAX) NULL,
    IsShared BIT NOT NULL CONSTRAINT DF_DecisionBoard_IsShared DEFAULT 0,

    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoard_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoard_UpdatedAt DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_DecisionBoard_ShortList
        FOREIGN KEY (ShortListID) REFERENCES ShortList(ID),
    CONSTRAINT FK_DecisionBoard_ComparisonBoard
        FOREIGN KEY (ComparisonBoardID) REFERENCES ComparisonBoard(ID),
    CONSTRAINT CK_DecisionBoard_Status
        CHECK (DecisionStatus IN (
            'Interested',
            'Viewing Arranged',
            'Viewing Completed',
            'Offer Considering',
            'Offer Made',
            'Offer Accepted',
            'Mortgage Applied',
            'Survey Booked',
            'Survey Completed',
            'Conveyancing Started',
            'Exchange Pending',
            'Exchanged',
            'Completed',
            'Withdrawn',
            'Rejected'
        )),
    CONSTRAINT CK_DecisionBoard_UserVerdict
        CHECK (UserVerdict IS NULL OR UserVerdict IN ('Strong Yes', 'Maybe', 'No', 'On Hold')),
    CONSTRAINT CK_DecisionBoard_Progress
        CHECK (ProgressPercent IS NULL OR (ProgressPercent >= 0 AND ProgressPercent <= 100))
);

CREATE INDEX IX_DecisionBoard_UserID_Status
    ON DecisionBoard(UserID, DecisionStatus);

CREATE INDEX IX_DecisionBoard_UserID_ListingID
    ON DecisionBoard(UserID, ListingID);

CREATE TABLE DecisionBoardTimeline (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    DecisionBoardID INT NOT NULL,

    StageName NVARCHAR(100) NOT NULL,
    [Status] NVARCHAR(60) NULL,
    Notes NVARCHAR(MAX) NULL,
    EventDate DATETIME2 NULL,

    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoardTimeline_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoardTimeline_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_DecisionBoardTimeline_Board
        FOREIGN KEY (DecisionBoardID) REFERENCES DecisionBoard(ID) ON DELETE CASCADE
);

CREATE INDEX IX_DecisionBoardTimeline_Board_Date
    ON DecisionBoardTimeline(DecisionBoardID, EventDate);

CREATE TABLE DecisionBoardMedia (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    DecisionBoardID INT NOT NULL,

    MediaType NVARCHAR(40) NOT NULL,
    FileUrl NVARCHAR(MAX) NOT NULL,
    Caption NVARCHAR(MAX) NULL,
    IsPublic BIT NOT NULL CONSTRAINT DF_DecisionBoardMedia_IsPublic DEFAULT 0,

    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoardMedia_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoardMedia_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_DecisionBoardMedia_Board
        FOREIGN KEY (DecisionBoardID) REFERENCES DecisionBoard(ID) ON DELETE CASCADE,
    CONSTRAINT CK_DecisionBoardMedia_Type
        CHECK (MediaType IN ('Photo', 'Video', 'Audio', 'Document'))
);

CREATE INDEX IX_DecisionBoardMedia_Board
    ON DecisionBoardMedia(DecisionBoardID);

CREATE TABLE DecisionBoardTask (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    DecisionBoardID INT NOT NULL,

    TaskName NVARCHAR(200) NOT NULL,
    TaskType NVARCHAR(80) NULL,
    [Status] NVARCHAR(60) NULL,
    DueDate DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    Notes NVARCHAR(MAX) NULL,

    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoardTask_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DecisionBoardTask_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_DecisionBoardTask_Board
        FOREIGN KEY (DecisionBoardID) REFERENCES DecisionBoard(ID) ON DELETE CASCADE
);

CREATE INDEX IX_DecisionBoardTask_Board_Status_DueDate
    ON DecisionBoardTask(DecisionBoardID, [Status], DueDate);
```

Decision statuses:

```text
Interested
Viewing Arranged
Viewing Completed
Offer Considering
Offer Made
Offer Accepted
Mortgage Applied
Survey Booked
Survey Completed
Conveyancing Started
Exchange Pending
Exchanged
Completed
Withdrawn
Rejected
```

User verdict values:

```text
Strong Yes
Maybe
No
On Hold
```

Example timeline stages:

```text
Viewing Arranged
Offer Submitted
Mortgage Approved
Survey Returned
Contracts Exchanged
```

Example tasks:

```text
Call estate agent
Book second viewing
Upload viewing video
Compare mortgage products
Book survey
Review legal documents
Chase solicitor
```

Decision Board responsibilities:

- Track viewings arranged with agents.
- Store user-uploaded videos, audio, personal photos, documents, and notes.
- Timeline the purchase/rental process.
- Track process stages like mortgage application, survey, conveyancing, offer status, and agent follow-up.
- Track actionable tasks with due dates and completion states.
- Support optional in-app sharing of selected notes/media if the user enables sharing.
- Store the user's `UserVerdict`, current stage, progress percentage, and evolving notes.
- Allow future social sharing of progress, photos, videos, notes, lessons learned, first-time buyer stories, renovation diaries, and investment case studies.

### Match Score System

`MatchScore` should be calculated differently depending on the user's intent. Store the final weighted result on `ShortListListing.MatchScore` and the raw components/explanation in `ShortListListing.ScoreBreakdownJson`.

Generic scorer:

```javascript
function calculateWeightedScore(scores, weights) {
  let total = 0;

  for (const key in weights) {
    total += (scores[key] || 0) * weights[key];
  }

  return Math.round(total);
}
```

#### Buyer Mode

Purpose:

```text
Find the best home to live in
```

Weights:

```javascript
const buyerWeights = {
  lifestyleScore: 0.25,
  schoolScore: 0.20,
  commuteScore: 0.20,
  priceScore: 0.20,
  spaceScore: 0.15
};
```

Calculation:

```javascript
matchScore =
  lifestyleScore * 0.25 +
  schoolScore * 0.20 +
  commuteScore * 0.20 +
  priceScore * 0.20 +
  spaceScore * 0.15;
```

#### Investor Mode

Purpose:

```text
Find the best investment opportunity
```

Weights:

```javascript
const investorWeights = {
  yieldScore: 0.30,
  discountScore: 0.25,
  growthScore: 0.20,
  rentalDemandScore: 0.15,
  riskScore: 0.10
};
```

Calculation:

```javascript
matchScore =
  yieldScore * 0.30 +
  discountScore * 0.25 +
  growthScore * 0.20 +
  rentalDemandScore * 0.15 +
  riskScore * 0.10;
```

Important:

```text
RiskScore should be inverted.
100 = Very low risk
0 = Very high risk
```

#### Developer Mode

Purpose:

```text
Find development opportunities
```

Weights:

```javascript
const developerWeights = {
  planningScore: 0.30,
  landScore: 0.20,
  pricePerSqftScore: 0.20,
  gdvUpsideScore: 0.20,
  riskScore: 0.10
};
```

Calculation:

```javascript
matchScore =
  planningScore * 0.30 +
  landScore * 0.20 +
  pricePerSqftScore * 0.20 +
  gdvUpsideScore * 0.20 +
  riskScore * 0.10;
```

### Backend Flow

```text
1. User completes onboarding/search preferences
      ↓
2. User performs property search
      ↓
3. Map listings are inserted into PropertyDeck + PropertyDeckListing
      ↓
4. User swipes deck:
      Skip -> PropertyDeckListing.Status = skipped
      Shortlist -> PropertyDeckListing.Status = shortlisted + ShortListListing upsert
      Ignore/no action -> remains matched
      ↓
5. Shortlisted properties receive:
      MatchScore
      PropertyRank
      YourFitRank
      ScoreBreakdownJson
      component scores
      ↓
6. User opens Compare Board
      ↓
7. Compare Board generates/stores:
      ProsJson
      ConsJson
      MetricsJson
      UserNotes
      head-to-head comparison output
      ↓
8. User opens/creates DecisionBoard
      ↓
9. DecisionBoard stores:
      UserVerdict
      viewing timeline
      agent updates
      mortgage/survey/conveyancing progress
      personal notes
      photos, videos, audio, and documents
      shareable journey updates
```

Guiding principle:

```text
Property Deck feels FAST.
Shortlist feels SMART.
Compare Board feels PREMIUM.
DecisionBoard feels EMPOWERING.
```

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

## DecisionBoard API Calls

The DecisionBoard is the fourth stage after discovery, shortlist ranking, and comparison. It is an ongoing workspace for a user's chosen property journey. It should not replace `ComparisonBoard`; it should link back to the relevant `ShortList` and/or `ComparisonBoard` where available.

All routes should enforce ownership through the logged-in user from the bearer token.

### Get Or Create DecisionBoard From Listing

`POST /api/decision-boards`

Use this when the user decides to pursue a property from the Shortlist or ComparisonBoard.

Request:

```json
{
  "listingId": "5501",
  "shortListId": "8",
  "comparisonBoardId": "31",
  "decisionStatus": "Interested",
  "userVerdict": "Maybe",
  "currentStage": "Interested",
  "notes": "Strong candidate. Need to arrange a viewing."
}
```

Backend behavior:

- Find an existing active `DecisionBoard` for `UserID + ListingID`, or create one.
- Link `ShortListID` and `ComparisonBoardID` if provided.
- Default `DecisionStatus = 'Interested'`.
- Default `CurrentStage = DecisionStatus`.
- Default `ProgressPercent = 0` if not supplied.
- Insert an initial `DecisionBoardTimeline` row when creating the board.

Response:

```json
{
  "decisionBoard": {
    "id": "91",
    "userId": "42",
    "listingId": "5501",
    "shortListId": "8",
    "comparisonBoardId": "31",
    "decisionStatus": "Interested",
    "userVerdict": "Maybe",
    "progressPercent": 0,
    "currentStage": "Interested",
    "notes": "Strong candidate. Need to arrange a viewing.",
    "isShared": false,
    "createdAt": "2026-06-14T10:00:00.000Z",
    "updatedAt": "2026-06-14T10:00:00.000Z",
    "listing": {
      "ID": "5501",
      "Title": "3 bed house",
      "Price": "£450,000",
      "ImageUrls": []
    },
    "timeline": [],
    "tasks": [],
    "media": []
  }
}
```

### Get User DecisionBoards

`GET /api/decision-boards?status=active`

Query params:

- `status`: optional. Can be `active`, `completed`, `archived`, or omitted for all user boards.
- `listingId`: optional. If supplied, return boards for one listing.

Response:

```json
{
  "decisionBoards": [
    {
      "id": "91",
      "listingId": "5501",
      "decisionStatus": "Viewing Arranged",
      "userVerdict": "Strong Yes",
      "progressPercent": 20,
      "currentStage": "Viewing Arranged",
      "isShared": false,
      "updatedAt": "2026-06-14T10:00:00.000Z",
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

### Get DecisionBoard Detail

`GET /api/decision-boards/:decisionBoardId`

Response:

```json
{
  "decisionBoard": {
    "id": "91",
    "listingId": "5501",
    "shortListId": "8",
    "comparisonBoardId": "31",
    "decisionStatus": "Viewing Arranged",
    "userVerdict": "Strong Yes",
    "progressPercent": 20,
    "currentStage": "Viewing Arranged",
    "notes": "Viewing booked for Saturday.",
    "isShared": false,
    "listing": {
      "ID": "5501",
      "Title": "3 bed house",
      "Price": "£450,000",
      "ImageUrls": []
    },
    "timeline": [
      {
        "id": "301",
        "stageName": "Viewing Arranged",
        "status": "completed",
        "notes": "Agent confirmed Saturday 10:30.",
        "eventDate": "2026-06-20T10:30:00.000Z",
        "createdAt": "2026-06-14T10:00:00.000Z"
      }
    ],
    "tasks": [
      {
        "id": "401",
        "taskName": "Call estate agent",
        "taskType": "agent",
        "status": "completed",
        "dueDate": null,
        "completedAt": "2026-06-14T10:20:00.000Z",
        "notes": null
      }
    ],
    "media": [
      {
        "id": "501",
        "mediaType": "Photo",
        "fileUrl": "https://cdn.example.com/photo.jpg",
        "caption": "Kitchen condition",
        "isPublic": false,
        "createdAt": "2026-06-14T10:30:00.000Z"
      }
    ]
  }
}
```

### Update DecisionBoard

`PATCH /api/decision-boards/:decisionBoardId`

Use this for status, verdict, notes, progress, sharing, and current stage updates.

Request:

```json
{
  "decisionStatus": "Mortgage Applied",
  "userVerdict": "Strong Yes",
  "progressPercent": 45,
  "currentStage": "Mortgage Applied",
  "notes": "Mortgage application submitted. Waiting for lender response.",
  "isShared": false
}
```

Backend behavior:

- Update only supplied fields.
- Validate `DecisionStatus` and `UserVerdict` against allowed values.
- Keep `ProgressPercent` between 0 and 100.
- If `DecisionStatus` changes, optionally insert a `DecisionBoardTimeline` row with the new stage.

Response:

```json
{
  "success": true,
  "decisionBoard": {
    "id": "91",
    "decisionStatus": "Mortgage Applied",
    "userVerdict": "Strong Yes",
    "progressPercent": 45,
    "currentStage": "Mortgage Applied",
    "notes": "Mortgage application submitted. Waiting for lender response.",
    "isShared": false,
    "updatedAt": "2026-06-14T12:00:00.000Z"
  }
}
```

### Add Timeline Event

`POST /api/decision-boards/:decisionBoardId/timeline`

Request:

```json
{
  "stageName": "Viewing Arranged",
  "status": "completed",
  "notes": "Agent confirmed Saturday 10:30.",
  "eventDate": "2026-06-20T10:30:00.000Z"
}
```

Response:

```json
{
  "timelineEvent": {
    "id": "301",
    "decisionBoardId": "91",
    "stageName": "Viewing Arranged",
    "status": "completed",
    "notes": "Agent confirmed Saturday 10:30.",
    "eventDate": "2026-06-20T10:30:00.000Z",
    "createdAt": "2026-06-14T10:00:00.000Z"
  }
}
```

### Update Timeline Event

`PATCH /api/decision-boards/:decisionBoardId/timeline/:timelineId`

Request:

```json
{
  "stageName": "Viewing Completed",
  "status": "completed",
  "notes": "Viewing complete. Kitchen needs work but location is strong.",
  "eventDate": "2026-06-20T10:30:00.000Z"
}
```

Response:

```json
{
  "success": true,
  "timelineEvent": {
    "id": "301",
    "stageName": "Viewing Completed",
    "status": "completed",
    "notes": "Viewing complete. Kitchen needs work but location is strong.",
    "eventDate": "2026-06-20T10:30:00.000Z"
  }
}
```

### Delete Timeline Event

`DELETE /api/decision-boards/:decisionBoardId/timeline/:timelineId`

Response:

```json
{
  "success": true
}
```

### Add Task

`POST /api/decision-boards/:decisionBoardId/tasks`

Request:

```json
{
  "taskName": "Book survey",
  "taskType": "survey",
  "status": "pending",
  "dueDate": "2026-06-25T09:00:00.000Z",
  "notes": "Ask agent for access dates."
}
```

Response:

```json
{
  "task": {
    "id": "401",
    "decisionBoardId": "91",
    "taskName": "Book survey",
    "taskType": "survey",
    "status": "pending",
    "dueDate": "2026-06-25T09:00:00.000Z",
    "completedAt": null,
    "notes": "Ask agent for access dates."
  }
}
```

### Update Task

`PATCH /api/decision-boards/:decisionBoardId/tasks/:taskId`

Request:

```json
{
  "taskName": "Book survey",
  "taskType": "survey",
  "status": "completed",
  "dueDate": "2026-06-25T09:00:00.000Z",
  "completedAt": "2026-06-21T15:00:00.000Z",
  "notes": "Survey booked with access confirmed."
}
```

Response:

```json
{
  "success": true,
  "task": {
    "id": "401",
    "status": "completed",
    "completedAt": "2026-06-21T15:00:00.000Z"
  }
}
```

### Delete Task

`DELETE /api/decision-boards/:decisionBoardId/tasks/:taskId`

Response:

```json
{
  "success": true
}
```

### Add Media

`POST /api/decision-boards/:decisionBoardId/media`

The frontend can either upload the file elsewhere first and send a `fileUrl`, or the backend can adapt this route to multipart upload later. The contract below assumes URL-based creation first.

Request:

```json
{
  "mediaType": "Photo",
  "fileUrl": "https://cdn.example.com/photo.jpg",
  "caption": "Kitchen condition",
  "isPublic": false
}
```

Response:

```json
{
  "media": {
    "id": "501",
    "decisionBoardId": "91",
    "mediaType": "Photo",
    "fileUrl": "https://cdn.example.com/photo.jpg",
    "caption": "Kitchen condition",
    "isPublic": false,
    "createdAt": "2026-06-14T10:30:00.000Z"
  }
}
```

### Update Media

`PATCH /api/decision-boards/:decisionBoardId/media/:mediaId`

Request:

```json
{
  "caption": "Kitchen condition after second viewing",
  "isPublic": true
}
```

Response:

```json
{
  "success": true,
  "media": {
    "id": "501",
    "caption": "Kitchen condition after second viewing",
    "isPublic": true
  }
}
```

### Delete Media

`DELETE /api/decision-boards/:decisionBoardId/media/:mediaId`

Response:

```json
{
  "success": true
}
```

### Share Or Unshare DecisionBoard

`PATCH /api/decision-boards/:decisionBoardId/share`

Request:

```json
{
  "isShared": true
}
```

Response:

```json
{
  "success": true,
  "decisionBoard": {
    "id": "91",
    "isShared": true
  }
}
```

Backend sharing rules:

- `DecisionBoard.IsShared` controls whether the journey can appear in future social/community surfaces.
- `DecisionBoardMedia.IsPublic` controls whether an individual media item can be shown publicly.
- Private notes, documents, audio, and video must remain private unless explicitly marked public by the user.

## DecisionBoard Refinement: Project Container Model

The frontend now treats `DecisionBoard` as a project container, not a single-property record.

When a user presses `Pursue in DecisionBoard`, the app routes to the DecisionBoard list/selector. The user can:

- Add the property to an existing DecisionBoard.
- Create a new DecisionBoard and add the property immediately.

### DecisionBoard

```sql
DecisionBoard
- ID
- UserID
- BoardName
- BoardType -- Buyer, Investor, Developer
- Status -- Active, Tentative, Closed
- MaxProperties
- CreatedAt
- UpdatedAt
```

Limits:

- Buyer: 10 active properties
- Investor: 20 active properties
- Developer: 20 active properties

The backend should reject adding a property when the board is at its active-property limit. Closed listings should not count against the active limit.

### DecisionBoardListing

```sql
DecisionBoardListing
- ID
- DecisionBoardID
- ListingID
- ListingStatus -- Active, Tentative, Closed
- TrafficLightStatus -- Green, Orange, Red
- ViewingDate
- ViewingStatus -- Arranged, Completed, Cancelled, Rescheduled
- UserVerdict -- StrongYes, Maybe, No, OnHold
- Notes
- CreatedAt
- UpdatedAt
```

Traffic light mapping used by the frontend:

- Green: Active / open / currently pursuing
- Orange: Tentative / waiting / on-hold
- Red: Closed / rejected / withdrawn

### RealEstateAgent

```sql
RealEstateAgent
- ID
- AgentName
- CompanyName
- BranchName
- Phone
- Email
- Website
- Address
- Notes
- CreatedAt
- UpdatedAt
```

Estate agents should be reusable records, not owned by a single DecisionBoard. This lets multiple boards and multiple listings reference the same person/company later, and gives us a clean place to add performance and business metrics.

### DecisionBoardAgent

```sql
DecisionBoardAgent
- ID
- DecisionBoardID
- RealEstateAgentID
- Notes
- CreatedAt
```

### DecisionBoardListingAgent

```sql
DecisionBoardListingAgent
- ID
- DecisionBoardListingID
- RealEstateAgentID
```

### Broker

```sql
Broker
- ID
- BrokerName
- CompanyName
- Phone
- Email
- Website
- Notes
- CreatedAt
- UpdatedAt
```

Mortgage brokers should also be reusable records so users can attach the same broker to several boards or properties and the product can later measure responsiveness, approval outcomes, and user satisfaction.

### DecisionBoardBroker

```sql
DecisionBoardBroker
- ID
- DecisionBoardID
- BrokerID
- Status -- Contacted, InProgress, Approved, Rejected, NotUsing
- Notes
- CreatedAt
```

### Property-Scoped Timeline, Media, And Tasks

These should attach to `DecisionBoardListingID`, not directly to `DecisionBoardID`.

```sql
DecisionBoardTimeline
- ID
- DecisionBoardListingID
- StageName
- Status
- Notes
- EventDate
- CreatedAt

DecisionBoardMedia
- ID
- DecisionBoardListingID
- MediaType -- Photo, Video, Audio, Document
- FileUrl
- Caption
- IsPublic
- CreatedAt

DecisionBoardTask
- ID
- DecisionBoardListingID
- TaskName
- TaskType
- Status
- DueDate
- CompletedAt
- Notes
```

### Frontend API Calls For Refined Model

```text
GET    /api/decision-boards
POST   /api/decision-boards
GET    /api/decision-boards/:decisionBoardId
PATCH  /api/decision-boards/:decisionBoardId

POST   /api/decision-boards/:decisionBoardId/listings
PATCH  /api/decision-boards/:decisionBoardId/listings/:decisionBoardListingId

POST   /api/decision-boards/:decisionBoardId/agents
POST   /api/decision-boards/:decisionBoardId/brokers

GET    /api/real-estate-agents?query=
POST   /api/real-estate-agents
GET    /api/brokers?query=
POST   /api/brokers

POST   /api/decision-board-listings/:decisionBoardListingId/timeline
POST   /api/decision-board-listings/:decisionBoardListingId/tasks
PATCH  /api/decision-board-listings/:decisionBoardListingId/tasks/:taskId
DELETE /api/decision-board-listings/:decisionBoardListingId/tasks/:taskId
```

The board-scoped `POST /agents` and `POST /brokers` endpoints can remain as convenience wrappers:

- If an existing `realEstateAgentId` or `brokerId` is supplied, link it to the board.
- If contact fields are supplied, create-or-find the reusable `RealEstateAgent` / `Broker`, then link it to the board.
- `GET /api/decision-boards/:decisionBoardId` should continue returning flattened `agents` and `brokers` arrays for the frontend, with reusable IDs included as `realEstateAgentId` and `brokerId`.

Expected `GET /api/decision-boards` response:

```json
{
  "decisionBoards": [
    {
      "id": "12",
      "boardName": "First Home Purchase",
      "boardType": "Buyer",
      "status": "Active",
      "maxProperties": 10,
      "listings": [],
      "agents": [],
      "brokers": []
    }
  ]
}
```

Expected `POST /api/decision-boards/:decisionBoardId/listings` request:

```json
{
  "listingId": "5501",
  "shortListId": "8",
  "comparisonBoardId": "31",
  "listingStatus": "Active",
  "trafficLightStatus": "Green",
  "userVerdict": "Maybe"
}
```
