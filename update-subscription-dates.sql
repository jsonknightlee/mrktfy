-- ========================================
-- Update Subscription Dates for Existing Mock Data
-- ========================================

-- Update User 55 (hunter@mrktfy.com) - ACTIVE Prospector subscription
UPDATE Profile 
SET 
    SubscriptionStartDate = '2026-04-26 10:00:00',
    SubscriptionEndDate = '2027-04-26 23:59:59',
    IsSubscriptionActive = 1,
    UpdatedAt = GETDATE()
WHERE UserID = '55';

-- Update User 56 - EXPIRED Investor subscription (for testing expired functionality)
UPDATE Profile 
SET 
    SubscriptionStartDate = '2025-04-26 10:00:00',
    SubscriptionEndDate = '2026-04-25 23:59:59',
    IsSubscriptionActive = 0,
    UpdatedAt = GETDATE()
WHERE UserID = '56';

-- Update User 57 - ACTIVE Free subscription (no end date)
UPDATE Profile 
SET 
    SubscriptionStartDate = '2026-04-26 10:00:00',
    SubscriptionEndDate = NULL,
    IsSubscriptionActive = 1,
    UpdatedAt = GETDATE()
WHERE UserID = '57';

-- Update User 58 - ACTIVE Developer subscription
UPDATE Profile 
SET 
    SubscriptionStartDate = '2026-04-26 10:00:00',
    SubscriptionEndDate = '2027-04-26 23:59:59',
    IsSubscriptionActive = 1,
    UpdatedAt = GETDATE()
WHERE UserID = '58';

-- Verify the updates
SELECT 
    p.UserID,
    u.Username as Email,
    sl.Name as SubscriptionLevel,
    sl.SearchRadiusKm,
    p.IsSubscriptionActive,
    p.SubscriptionStartDate,
    p.SubscriptionEndDate,
    CASE 
        WHEN p.SubscriptionEndDate IS NULL THEN 'Never (Free Tier)'
        WHEN p.SubscriptionEndDate < GETDATE() THEN 'EXPIRED'
        WHEN p.SubscriptionEndDate >= GETDATE() THEN 'ACTIVE'
        ELSE 'Unknown'
    END as SubscriptionStatus
FROM Profile p
LEFT JOIN Users u ON p.UserID = u.ID
LEFT JOIN SubscriptionLevel sl ON p.SubscriptionLevelID = sl.ID
WHERE p.UserID IN ('55', '56', '57', '58')
ORDER BY p.UserID;
