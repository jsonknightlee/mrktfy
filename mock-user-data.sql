-- ========================================
-- Mock Data for User Testing
-- ========================================
-- User ID: 55 (hunter@mrktfy.com)

-- Insert mock profile data for user 55
INSERT INTO Profile (
    UserID,
    Phone,
    Address,
    City,
    PostalCode,
    Country,
    Latitude,
    Longitude,
    ListingTypePreference,
    PropertyTypePreferences,
    PriceRangeMin,
    PriceRangeMax,
    NotificationPreferences,
    SearchPreferences,
    SubscriptionLevelID,
    SubscriptionStartDate,
    SubscriptionEndDate,
    IsSubscriptionActive,
    ProfileImageUrl,
    Bio,
    CreatedAt,
    UpdatedAt
) VALUES (
    '55', -- UserID matching the Users table
    '+44 20 7123 4567', -- Phone
    '123 Kensington High Street', -- Address
    'London', -- City
    'W8 5ED', -- PostalCode
    'United Kingdom', -- Country
    51.4993, -- Latitude (Kensington area)
    -0.1938, -- Longitude (Kensington area)
    'both', -- ListingTypePreference (for-sale and to-rent)
    '["Apartment", "House", "Flat", "Terraced", "Detached"]', -- PropertyTypePreferences (JSON)
    250000.00, -- PriceRangeMin (£250k)
    850000.00, -- PriceRangeMax (£850k)
    '{
        "emailAlerts": true,
        "pushNotifications": true,
        "priceDropAlerts": true,
        "newListingAlerts": true,
        "weeklyDigest": false,
        "marketingEmails": false
    }', -- NotificationPreferences (JSON)
    '{
        "defaultRadius": 5,
        "preferredAreas": ["Kensington", "Chelsea", "Notting Hill"],
        "minBedrooms": 2,
        "maxBedrooms": 4,
        "mustHaveParking": true,
        "mustHaveGarden": false,
        "propertyTypes": ["Apartment", "House"],
        "savedSearches": [
            {
                "name": "2-bed flats in Kensington",
                "filters": {
                    "bedrooms": 2,
                    "propertyType": "Apartment",
                    "area": "Kensington"
                }
            },
            {
                "name": "Houses with parking",
                "filters": {
                    "parking": true,
                    "propertyType": "House"
                }
            }
        ]
    }', -- SearchPreferences (JSON)
    'prospector', -- SubscriptionLevelID (mid-tier subscription)
    '2024-04-26 10:00:00', -- SubscriptionStartDate (current date)
    '2025-04-26 23:59:59', -- SubscriptionEndDate (1 year from now - ACTIVE)
    1, -- IsSubscriptionActive (1 = true)
    'https://example.com/profiles/hunter-mrktfy-avatar.jpg', -- ProfileImageUrl
    'Property enthusiast and investor looking for prime London real estate opportunities. Interested in both residential investments and finding the perfect home.', -- Bio
    GETDATE(), -- CreatedAt
    GETDATE()  -- UpdatedAt
);

-- Additional mock profiles for testing different subscription levels
INSERT INTO Profile (
    UserID, Phone, Address, City, PostalCode, Country, Latitude, Longitude,
    ListingTypePreference, PropertyTypePreferences, PriceRangeMin, PriceRangeMax,
    NotificationPreferences, SearchPreferences, SubscriptionLevelID,
    SubscriptionStartDate, SubscriptionEndDate, IsSubscriptionActive,
    ProfileImageUrl, Bio, CreatedAt, UpdatedAt
) VALUES 
(
    '56', '+44 20 8456 7890', '456 Oxford Street', 'London', 'W1D 1BX', 'United Kingdom',
    51.5154, -0.1419, 'for-sale', '["Apartment", "Penthouse"]', 500000.00, 2000000.00,
    '{"emailAlerts": true, "pushNotifications": true, "priceDropAlerts": true, "newListingAlerts": true}',
    '{"defaultRadius": 10, "preferredAreas": ["Mayfair", "Marylebone"], "minBedrooms": 3}',
    'investor', '2023-04-26 10:00:00', '2024-04-25 23:59:59', 0, -- EXPIRED (yesterday)
    'https://example.com/profiles/user56-avatar.jpg', 'High-end property investor focusing on prime central London.',
    GETDATE(), GETDATE()
),
(
    '57', '+44 20 1234 5678', '789 Brick Lane', 'London', 'E1 6PU', 'United Kingdom',
    51.5236, -0.0716, 'to-rent', '["Flat", "Studio"]', 1200.00, 2500.00,
    '{"emailAlerts": false, "pushNotifications": true, "priceDropAlerts": false}',
    '{"defaultRadius": 2, "preferredAreas": ["Shoreditch", "Hackney"], "maxRent": 2500}',
    'free', '2024-04-26 10:00:00', NULL, 1, -- ACTIVE (free tier has no end date)
    'https://example.com/profiles/user57-avatar.jpg', 'Young professional looking for rental in East London.',
    GETDATE(), GETDATE()
),
(
    '58', '+44 20 9876 5432', '321 Canary Wharf', 'London', 'E14 5AB', 'United Kingdom',
    51.5044, -0.0198, 'both', '["Apartment", "House", "Penthouse"]', 300000.00, 5000000.00,
    '{"emailAlerts": true, "pushNotifications": true, "priceDropAlerts": true, "newListingAlerts": true, "weeklyDigest": true}',
    '{"defaultRadius": 20, "preferredAreas": ["Canary Wharf", "Isle of Dogs"], "minBedrooms": 1, "maxBedrooms": 5}',
    'developer', '2024-04-26 10:00:00', '2025-04-26 23:59:59', 1, -- ACTIVE (1 year from now)
    'https://example.com/profiles/user58-avatar.jpg', 'Real estate developer and portfolio manager with extensive London market knowledge.',
    GETDATE(), GETDATE()
);

-- Query to verify the data was inserted correctly
SELECT 
    p.UserID,
    u.Username as Email,
    p.FirstName,
    p.LastName,
    p.Phone,
    p.City,
    p.ListingTypePreference,
    sl.Name as SubscriptionLevel,
    p.IsSubscriptionActive,
    p.SubscriptionStartDate,
    p.SubscriptionEndDate
FROM Profile p
LEFT JOIN Users u ON p.UserID = u.ID
LEFT JOIN SubscriptionLevel sl ON p.SubscriptionLevelID = sl.ID
WHERE p.UserID = '55';
