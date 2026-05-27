-- ========================================
-- Database Schema for Mrktfy App (SQL Server)
-- ========================================

-- Subscription Levels Table
CREATE TABLE SubscriptionLevel (
    ID VARCHAR(50) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Description TEXT,
    Price DECIMAL(10, 2),
    BillingPeriod VARCHAR(20), -- 'month', 'year'
    SearchRadiusKm INT NOT NULL DEFAULT 2,
    Features NVARCHAR(MAX), -- Array of features as JSON
    Limits NVARCHAR(MAX), -- Usage limits as JSON object
    Color VARCHAR(7), -- Hex color code
    IsActive BIT DEFAULT 1,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- User Profiles Table
CREATE TABLE Profile (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    UserID VARCHAR(255) UNIQUE NOT NULL, -- Foreign key to Users table
    Phone VARCHAR(20),
    Address TEXT,
    City VARCHAR(100),
    PostalCode VARCHAR(20),
    Country VARCHAR(100),
    Latitude DECIMAL(10, 8),
    Longitude DECIMAL(11, 8),
    ListingTypePreference VARCHAR(20), -- 'for-sale', 'to-rent', 'both'
    PropertyTypePreferences NVARCHAR(MAX), -- Array of preferred property types
    PriceRangeMin DECIMAL(12, 2),
    PriceRangeMax DECIMAL(12, 2),
    NotificationPreferences NVARCHAR(MAX), -- Notification settings
    SearchPreferences NVARCHAR(MAX), -- Saved search filters and preferences
    SubscriptionLevelID VARCHAR(50),
    SubscriptionStartDate DATETIME,
    SubscriptionEndDate DATETIME,
    IsSubscriptionActive BIT DEFAULT 1,
    ProfileImageUrl TEXT,
    Bio TEXT,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    
    FOREIGN KEY (SubscriptionLevelID) REFERENCES SubscriptionLevel(ID)
);

-- Insert default subscription levels
INSERT INTO SubscriptionLevel (ID, Name, Description, Price, BillingPeriod, SearchRadiusKm, Features, Limits, Color, SortOrder) VALUES
('free', 'Free Trial', 'Basic property search with limited features', 0.00, 'month', 2, 
'["Search up to 10 properties", "Basic map view", "Save up to 10 properties", "Limited notifications"]',
'{"savedSearchesMax": 5, "alertsEnabled": false, "refreshPriority": "normal", "notificationsPerMonth": 5, "arSearchesPerMonth": 10}',
'#666666', 1),

('prospector', 'Prospector', 'Find deals before others do', 9.99, 'month', 5,
'["Advanced filters", "Saved searches", "Unlimited favourites", "Price-drop alerts", "Faster listing refresh", "Enhanced AR highlights"]',
'{"savedSearchesMax": 20, "alertsEnabled": true, "refreshPriority": "high", "notificationsPerMonth": 100, "arSearchesPerMonth": 50}',
'#007AFF', 2),

('investor', 'Investor', 'Track, analyse, and act at scale', 29.99, 'month', 10,
'["Multi-area tracking", "Watchlists & collections", "Stronger deal signals", "Priority listing refresh", "Export & sharing tools", "Investor analytics"]',
'{"savedSearchesMax": 200, "alertsEnabled": true, "refreshPriority": "priority", "notificationsPerMonth": 500, "arSearchesPerMonth": 200}',
'#10B981', 3),

('developer', 'Developer', 'Build, scale, and automate', 49.99, 'month', 20,
'["Bulk area & land tracking", "Planning & zoning overlays", "Development opportunity signals", "Multi-user access", "Advanced reporting & exports", "API access"]',
'{"savedSearchesMax": 1000, "alertsEnabled": true, "refreshPriority": "max", "notificationsPerMonth": "unlimited", "arSearchesPerMonth": "unlimited"}',
'#6366F1', 4);

-- Create indexes for better performance
CREATE INDEX idx_profile_UserID ON Profile(UserID);
CREATE INDEX idx_profile_SubscriptionLevelID ON Profile(SubscriptionLevelID);
CREATE INDEX idx_profile_location ON Profile(Latitude, Longitude);
CREATE INDEX idx_subscriptionLevel_active ON SubscriptionLevel(IsActive);
GO

-- Add trigger to update subscription status based on dates
CREATE TRIGGER tr_UpdateSubscriptionStatus
ON Profile
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @SubscriptionEndDate DATETIME;
    SELECT @SubscriptionEndDate = i.SubscriptionEndDate FROM inserted i;
    
    UPDATE p
    SET IsSubscriptionActive = CASE 
        WHEN @SubscriptionEndDate IS NOT NULL AND @SubscriptionEndDate < GETDATE() THEN 0
        ELSE 1
    END
    FROM Profile p
    INNER JOIN inserted i ON p.ID = i.ID;
END;
