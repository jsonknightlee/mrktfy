import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../contexts/SubscriptionContext';
import { askBuyerWorkspaceAssistant } from '../services/BuyerWorkspaceService';
import { getDecisionBoard, getDecisionBoardMediaOpenUrl } from '../services/DecisionBoardService';
import { getListingById } from '../services/listingApi';
import {
  archivePropertyDeck,
  destroyPropertyDeck,
  dismissDeckListing,
  getListingId,
  getMatchedDeckListings,
  getPropertyDeckLimit,
  getPropertyDecks,
  getShortlist,
  removeFromShortlist,
  renamePropertyDeck,
  restorePropertyDeck,
  saveToShortlist,
} from '../services/PropertyDeckService';

const APP_PURPLE = '#6366F1';
const BUY_CHECKLIST_PROGRESS_KEY = 'mrktfy_buy_checklist_progress';
const SWIPE_THRESHOLD = 90;
const RICH_FILTER_ENRICHMENT_MATCH_LIMIT = 20;
const FLOW_STEPS = [
  { key: 'detail', label: 'Property Deck' },
  { key: 'shortlist', label: 'Shortlist' },
  { key: 'decision', label: 'Decision' },
  { key: 'buy', label: 'Buy' },
];
const ROUTE_FLOW_MODES = new Set(['detail', 'shortlist', 'buy']);

const BUY_CHECKLIST = [
  {
    title: 'Mortgage In Principle',
    status: 'In Progress',
    tasks: ['Obtain an Agreement in Principle', 'Confirm borrowing capacity', 'Compare mortgage products', 'Save lender details'],
    questions: ['Can I comfortably afford this property?', 'What happens if rates rise?'],
  },
  {
    title: 'Research Affordability',
    status: 'Not Started',
    tasks: ['Review deposit requirements', 'Estimate monthly repayments', 'Review legal costs', 'Review moving costs', 'Review stamp duty implications'],
    questions: ['Can I comfortably afford this property?', 'What happens if rates rise?'],
  },
  {
    title: 'Arrange Property Viewings',
    status: 'Not Started',
    tasks: ['First viewing', 'Second viewing', 'Evening viewing', 'Weekend viewing'],
    questions: ['Noise', 'Parking', 'Neighbours', 'Mobile signal', 'Traffic', 'Local amenities'],
  },
  {
    title: 'Choose Conveyancer / Solicitor',
    status: 'Not Started',
    tasks: ['Obtain quotes', 'Compare reviews', 'Instruct solicitor', 'Provide identification'],
    questions: ['Fixed fee?', 'No-sale-no-fee?', 'Expected timeline?'],
  },
  {
    title: 'Submit Offer',
    status: 'Not Started',
    tasks: ['Decide offer amount', 'Review comparable sales', 'Submit offer', 'Track negotiation history'],
    questions: ['Am I overpaying?', 'What evidence supports my offer?'],
  },
  {
    title: 'Offer Accepted',
    status: 'Not Started',
    tasks: ['Offer accepted', 'Memorandum of sale issued', 'Parties introduced'],
    questions: ['Seller chain', 'Estate agent contacts', 'Expected timescales'],
  },
  {
    title: 'Submit Full Mortgage Application',
    status: 'Not Started',
    tasks: ['Upload documents', 'Provide payslips', 'Provide bank statements', 'Provide identification', 'Submit application'],
    questions: ['Application date', 'Lender', 'Broker', 'Expected decision date'],
  },
  {
    title: 'Survey & Property Checks',
    status: 'Not Started',
    tasks: ['Book survey', 'Receive report', 'Review findings', 'Obtain contractor quotes if needed'],
    questions: ['Any structural issues?', 'Any expensive repairs?', 'Should I renegotiate?'],
  },
  {
    title: 'Conveyancing & Searches',
    status: 'Not Started',
    tasks: ['Local authority searches', 'Environmental searches', 'Water searches', 'Title review', 'Contract review'],
    questions: ['Any restrictions?', 'Any planning issues?', 'Any legal concerns?'],
  },
  {
    title: 'Exchange & Completion',
    status: 'Not Started',
    tasks: ['Exchange contracts', 'Transfer deposit', 'Arrange insurance', 'Arrange removals', 'Completion day'],
    questions: ['Keys collected', 'Property purchased'],
  },
];

const BUY_CONSIDERATIONS = [
  { title: 'Financial', items: ['Mortgage affordability', 'Interest rate changes', 'Emergency fund', 'Future maintenance costs', 'Insurance costs'] },
  { title: 'Lifestyle', items: ['Commute', 'Schools', 'Neighbourhood', 'Parking', 'Noise', 'Future family plans'] },
  { title: 'Property Condition', items: ['Roof', 'Damp', 'Heating', 'Windows', 'Electrical systems', 'Plumbing'] },
  { title: 'Legal', items: ['Leasehold terms', 'Restrictions', 'Boundary issues', 'Planning history', 'Rights of way'] },
  { title: 'Future Value', items: ['Resale potential', 'Extension potential', 'Area development', 'Rental potential', 'Local demand'] },
];

const BUY_ASSISTANT_MODES = [
  { key: 'offer', label: 'Offer', icon: 'pricetag-outline', placeholder: 'I like this property. Asking price is... I am thinking about offering...' },
  { key: 'counter', label: 'Counter', icon: 'swap-horizontal-outline', placeholder: 'The agent replied that the seller wants at least...' },
  { key: 'survey', label: 'Survey issue', icon: 'construct-outline', placeholder: 'The survey found damp / roof / electrical issues...' },
  { key: 'agent', label: 'Agent reply', icon: 'chatbubble-ellipses-outline', placeholder: 'Paste or summarise what the estate agent said...' },
  { key: 'decision', label: 'Decision', icon: 'git-compare-outline', placeholder: 'I am choosing between this property and another option...' },
];

const BUY_ASSISTANT_PLAYBOOK = {
  offer: {
    title: 'Opening offer strategy',
    recommendation: 'Start with an evidence-led offer that leaves room to move. Keep your first message calm, specific, and tied to comparables, property condition, and your readiness to proceed.',
    options: [
      { label: 'Cautious', action: 'Open below your target and ask the agent what evidence would help the seller move.', reasoning: 'Useful when demand feels soft or the property has been sitting.' },
      { label: 'Balanced', action: 'Offer near your evidence-backed fair value and hold back one planned increase.', reasoning: 'Keeps you credible while preserving negotiation room.' },
      { label: 'Strong', action: 'Open close to your ceiling only if the property is rare and your finances are ready.', reasoning: 'Best when losing the property would be worse than paying a little more.' },
    ],
    risks: ['Do not reveal your maximum budget early.', 'Do not increase without asking what would secure acceptance.', 'Keep survey/legal findings as future negotiation points.'],
    questions: ['How long has it been listed?', 'Have there been price reductions?', 'What comparable sales support your number?'],
    draft: 'We like the property and are in a position to proceed. Based on our review of the market and the work still to confirm through survey/legal checks, we would like to offer [amount].',
  },
  counter: {
    title: 'Counter-offer response',
    recommendation: 'Treat the seller number as a signal, not a fact. Ask whether that figure would secure the property, then decide whether to hold, move slightly, or ask for evidence.',
    options: [
      { label: 'Hold', action: 'Keep your offer unchanged and ask the agent to keep you updated.', reasoning: 'Works if your offer is defensible and you are comfortable walking away.' },
      { label: 'Small move', action: 'Increase modestly with a clear final-review tone.', reasoning: 'Shows goodwill without letting the seller control your ceiling.' },
      { label: 'Conditional move', action: 'Increase only if the seller agrees to stop viewings or set a clear acceptance condition.', reasoning: 'Turns extra money into certainty rather than just another bid.' },
    ],
    risks: ['The agent may be testing your ceiling.', 'A large jump can reset the seller expectation.', 'A verbal “minimum” is not the same as acceptance.'],
    questions: ['Would that figure take it off the market?', 'Are there other proceedable buyers?', 'What is driving the seller timeline?'],
    draft: 'Thanks for the update. Before we revise our position, can you confirm whether [amount] would secure acceptance and remove the property from further viewings?',
  },
  survey: {
    title: 'Survey issue strategy',
    recommendation: 'Separate urgent defects from normal maintenance. Get quotes where possible, then decide whether the issue changes price, risk, or your willingness to proceed.',
    options: [
      { label: 'Clarify', action: 'Ask the surveyor what needs immediate action and what can wait.', reasoning: 'Avoid overreacting to broad survey language.' },
      { label: 'Evidence', action: 'Get contractor quotes before renegotiating.', reasoning: 'A quantified repair cost gives your request weight.' },
      { label: 'Renegotiate', action: 'Ask for a reduction or contribution tied to documented costs.', reasoning: 'Works best when the issue was not visible before offer.' },
    ],
    risks: ['Some issues are lender-sensitive.', 'Quotes may uncover wider problems.', 'The seller may resist if the defect was obvious at viewing.'],
    questions: ['Is it structural, safety-related, or routine maintenance?', 'Will the lender care?', 'What would it cost to fix properly?'],
    draft: 'Following the survey, we need to understand the likely cost and urgency of [issue]. We are obtaining quotes and may need to revisit the agreed price once the position is clearer.',
  },
  agent: {
    title: 'Agent message analysis',
    recommendation: 'Read the agent reply for leverage: urgency, competition, seller confidence, and whether they are inviting a move or closing the door.',
    options: [
      { label: 'Ask', action: 'Request specifics before changing your position.', reasoning: 'Prevents negotiating against vague pressure.' },
      { label: 'Anchor', action: 'Restate your evidence and buying position.', reasoning: 'Keeps the conversation grounded in facts.' },
      { label: 'Probe', action: 'Ask what terms matter besides price.', reasoning: 'Speed, chain position, or certainty can matter as much as pounds.' },
    ],
    risks: ['Agent wording may be tactical.', 'Competition can be real or overstated.', 'Speed pressure can push you past your plan.'],
    questions: ['What exactly has changed?', 'Is price the only concern?', 'What would make our offer stronger?'],
    draft: 'Thanks. Could you help us understand what matters most to the seller here: price, speed, certainty, or timing? We want to put forward the strongest sensible position.',
  },
  decision: {
    title: 'Buyer decision soundboard',
    recommendation: 'Compare the property against your actual buyer goals, not just the excitement of the moment. Use ranking, affordability, condition, and lifestyle tradeoffs together.',
    options: [
      { label: 'Proceed', action: 'Move forward if the property is strong on must-haves and risks are manageable.', reasoning: 'Best when compromises are understood and affordable.' },
      { label: 'Pause', action: 'Gather one missing piece of evidence before committing.', reasoning: 'Useful when uncertainty is specific and answerable.' },
      { label: 'Walk', action: 'Step back if cost, risk, or lifestyle compromise breaks your original criteria.', reasoning: 'A good property is not good if it breaks the plan.' },
    ],
    risks: ['Emotional momentum can override budget.', 'A high rank does not remove legal/survey risk.', 'A poor negotiation can damage an otherwise good purchase.'],
    questions: ['What would make you regret buying it?', 'What would make you regret losing it?', 'Which facts are still missing?'],
    draft: 'Current buyer view: this property is worth pursuing if the price stays within plan and the remaining checks do not reveal material issues.',
  },
};

const getDecisionListingMediaType = (item) => {
  const value = String(item?.mediaType || item?.MediaType || 'Document').toLowerCase();
  if (value === 'photo' || value === 'image') return 'Photo';
  if (value === 'video') return 'Video';
  if (value === 'audio') return 'Audio';
  return 'Document';
};
const getDecisionListingNoteText = (item) => item?.noteText || item?.NoteText || item?.notes || item?.Notes || '';
const getDecisionListingTimelineTitle = (item) => item?.stageName || item?.StageName || item?.status || item?.Status || 'Timeline event';
const getDecisionListingTimelineNotes = (item) => item?.notes || item?.Notes || '';
const getDecisionListingDate = (item) => item?.eventDate || item?.EventDate || item?.createdAt || item?.CreatedAt || item?.updatedAt || item?.UpdatedAt;
const getDecisionListingTaskTitle = (item) => item?.taskName || item?.TaskName || 'Task';
const getDecisionListingTaskStatus = (item) => item?.status || item?.Status || 'pending';
const getParticipantName = (item, type) => {
  const nested = type === 'broker' ? item?.broker || item?.Broker : item?.agent || item?.Agent;
  return (
    nested?.brokerName ||
    nested?.BrokerName ||
    nested?.agentName ||
    nested?.AgentName ||
    item?.brokerName ||
    item?.BrokerName ||
    item?.agentName ||
    item?.AgentName ||
    item?.companyName ||
    item?.CompanyName ||
    'Linked contact'
  );
};
const PROPERTY_TYPE_OPTIONS = [
  { key: 'all', label: 'Show all' },
  { key: 'detached', label: 'Detached', terms: ['detached'] },
  { key: 'semi-detached', label: 'Semi-detached', terms: ['semi-detached', 'semi detached'] },
  { key: 'terraced', label: 'Terraced', terms: ['terraced', 'terrace'] },
  { key: 'flat', label: 'Flats', terms: ['flat', 'apartment', 'maisonette'] },
  { key: 'bungalow', label: 'Bungalows', terms: ['bungalow'] },
  { key: 'land', label: 'Farms/land', terms: ['farm', 'land', 'plot', 'equestrian'] },
  { key: 'park-home', label: 'Park homes', terms: ['park home', 'mobile home'] },
];
const TRI_STATE_OPTIONS = ['include', 'exclude', 'only'];
const SPECIAL_FILTERS = [
  { key: 'newBuild', label: 'New-build homes', terms: ['new build', 'new-build', 'new home', 'newly built'] },
  { key: 'sharedOwnership', label: 'Shared ownership', terms: ['shared ownership'] },
  { key: 'retirement', label: 'Retirement homes', terms: ['retirement', 'over 55', 'over 60', 'warden'] },
  { key: 'auction', label: 'Auction', terms: ['auction'] },
];
const MUST_HAVE_FILTERS = [
  { key: 'garden', label: 'Garden', terms: ['garden', 'gardens', 'grounds', 'outside space', 'rear lawn'], searchScope: 'details' },
  { key: 'parking', label: 'Parking/garage', terms: ['parking', 'garage', 'garaging', 'driveway', 'drive way', 'off street', 'off-street', 'allocated parking', 'parking space'] },
  { key: 'balcony', label: 'Balcony/terrace', terms: ['balcony', 'terrace', 'roof terrace', 'patio', 'decking'], searchScope: 'details' },
];
const OWNERSHIP_OPTIONS = [
  { key: 'all', label: 'Show all' },
  { key: 'leasehold', label: 'Leasehold', terms: ['leasehold'] },
  { key: 'freehold', label: 'Freehold', terms: ['freehold'] },
  { key: 'share-of-freehold', label: 'Share of freehold', terms: ['share of freehold'] },
];
const STATUS_FILTERS = [
  { key: 'chainFree', label: 'Chain-free', terms: ['chain free', 'chain-free', 'no onward chain'] },
  { key: 'reduced', label: 'Reduced price', terms: ['reduced', 'price reduction', 'reduced price'] },
  { key: 'underOffer', label: 'Under offer or sold STC', terms: ['under offer', 'sold stc', 'sstc'] },
];
const FEATURE_OPTIONS = [
  { key: 'all', label: 'Show all' },
  { key: 'fixer', label: 'Fixer upper', terms: ['fixer', 'renovation', 'modernisation', 'refurbishment', 'needs work'] },
  { key: 'period', label: 'Period property', terms: ['period', 'victorian', 'edwardian', 'georgian'] },
  { key: 'cottage', label: 'Cottage', terms: ['cottage'] },
  { key: 'modern', label: 'Modern', terms: ['modern', 'contemporary'] },
  { key: 'ev', label: 'EV Charging', terms: ['ev charging', 'electric vehicle', 'charging point'] },
  { key: 'utility', label: 'Utility room', terms: ['utility room'] },
  { key: 'basement', label: 'Basement', terms: ['basement', 'cellar'] },
  { key: 'conservatory', label: 'Conservatory', terms: ['conservatory'] },
  { key: 'office', label: 'Home office', terms: ['home office', 'study'] },
  { key: 'ensuite', label: 'En-suite', terms: ['en-suite', 'ensuite'] },
  { key: 'bathtub', label: 'Bathtub', terms: ['bathtub', 'bath tub'] },
  { key: 'patio', label: 'Patio', terms: ['patio'] },
  { key: 'island', label: 'Kitchen island', terms: ['kitchen island', 'island kitchen'] },
];
const ADDED_OPTIONS = [
  { key: 'any', label: 'Anytime', days: null },
  { key: '24h', label: 'Last 24 hours', days: 1 },
  { key: '3d', label: 'Last 3 days', days: 3 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '14d', label: 'Last 14 days', days: 14 },
  { key: '30d', label: 'Last 30 days', days: 30 },
];
const SHOW_DATE_ADDED_FILTER = false;
const createDefaultDeckFilters = () => ({
  propertyType: 'all',
  special: SPECIAL_FILTERS.reduce((acc, item) => ({ ...acc, [item.key]: 'include' }), {}),
  mustHaves: [],
  ownership: 'all',
  statuses: [],
  feature: 'all',
  added: 'any',
});

const normalizeImageUrls = (listing, depth = 0) => {
  if (!listing || depth > 1) return [];

  const imageSources = [
    listing?.ImageUrls,
    listing?.imageUrls,
    listing?.ImageUrl,
    listing?.imageUrl,
  ];

  for (const source of imageSources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      return source.filter(Boolean);
    }

    if (typeof source === 'string') {
      const value = source.trim();
      if (!value) continue;

      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.filter(Boolean);
          }
        } catch {
          // Fall through to delimiter parsing.
        }
      }

      return value.split(/[,|;]+/).map((item) => item.trim()).filter(Boolean);
    }
  }

  const nestedListing = listing?.listing || listing?.Listing || listing?.property || listing?.Property || listing?.propertyListing || listing?.PropertyListing;
  if (nestedListing && nestedListing !== listing) {
    return normalizeImageUrls(nestedListing, depth + 1);
  }

  return [];
};

const getDisplayListing = (listing) => {
  if (!listing) return listing;

  const sourceListing = listing.listing || listing.Listing || listing.property || listing.Property || listing.propertyListing || listing.PropertyListing || listing;

  return {
    ...listing,
    ...sourceListing,
    ID: getListingId(sourceListing) || getListingId(listing),
    Title: sourceListing.Title ?? sourceListing.title ?? listing.Title ?? listing.title,
    Price: sourceListing.Price ?? sourceListing.price ?? listing.Price ?? listing.price,
    Description: sourceListing.Description ?? sourceListing.description ?? listing.Description ?? listing.description,
    ImageUrls: sourceListing.ImageUrls ?? sourceListing.imageUrls ?? sourceListing.imageUrl ?? listing.ImageUrls ?? listing.imageUrls ?? listing.imageUrl,
    PropertyTimeline: sourceListing.PropertyTimeline ?? sourceListing.propertyTimeline ?? listing.PropertyTimeline ?? listing.propertyTimeline,
    AdditionalInfo: sourceListing.AdditionalInfo ?? sourceListing.additionalInfo ?? listing.AdditionalInfo ?? listing.additionalInfo,
    Schools: sourceListing.Schools ?? sourceListing.NearbySchools ?? sourceListing.nearbySchools ?? listing.Schools ?? listing.NearbySchools ?? listing.nearbySchools,
    Stations: sourceListing.Stations ?? sourceListing.NearbyStations ?? sourceListing.nearbyStations ?? listing.Stations ?? listing.NearbyStations ?? listing.nearbyStations,
    Latitude: sourceListing.Latitude ?? sourceListing.latitude ?? listing.Latitude ?? listing.latitude,
    Longitude: sourceListing.Longitude ?? sourceListing.longitude ?? listing.Longitude ?? listing.longitude,
    ListingURL: sourceListing.ListingURL ?? sourceListing.listingUrl ?? sourceListing.listingURL ?? listing.ListingURL ?? listing.listingUrl ?? listing.listingURL,
    AgentPhone: sourceListing.AgentPhone ?? sourceListing.agentPhone ?? listing.AgentPhone ?? listing.agentPhone,
    AgentEmail: sourceListing.AgentEmail ?? sourceListing.agentEmail ?? listing.AgentEmail ?? listing.agentEmail,
    distanceMiles: listing.distanceMiles ?? listing.DistanceMiles ?? sourceListing.distanceMiles ?? sourceListing.DistanceMiles,
    SearchDistanceMiles: listing.SearchDistanceMiles ?? listing.searchDistanceMiles ?? sourceListing.SearchDistanceMiles ?? sourceListing.searchDistanceMiles,
    propertyDeckListingId: listing.propertyDeckListingId || listing.PropertyDeckListingID || sourceListing.propertyDeckListingId || sourceListing.PropertyDeckListingID,
  };
};

const hasDescriptionText = (listing) => Boolean(listing?.Description || listing?.description);

const deckFiltersNeedRichListingData = (filters) => (
  Boolean(filters?.mustHaves?.length) ||
  Boolean(filters?.ownership && filters.ownership !== 'all')
);

const getDeckSearchLocationLabel = (deck) => {
  const filterJson = parseJsonObject(deck?.filterJson || deck?.FilterJson);
  const label = filterJson?.searchLocationLabel || filterJson?.SearchLocationLabel;
  const query = filterJson?.searchLocationQuery || filterJson?.SearchLocationQuery;
  const source = filterJson?.searchLocationSource || filterJson?.SearchLocationSource;
  if (label) return label;
  if (query) return query;
  if (source === 'user') return 'Current location';
  return null;
};

const formatPrice = (price) => {
  if (!price) return 'Price on request';
  if (typeof price === 'number') return `£${price.toLocaleString()}`;
  return price;
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';

  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return '';
  }
};

const clampRating = (value) => Math.max(0, Math.min(100, Math.round(value || 0)));

const parseJsonObject = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') return parseJsonObject(parsed);
    return parsed;
  } catch {
    return null;
  }
};

const flattenForSearch = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(flattenForSearch).join(' ');
  if (typeof value === 'object') return Object.values(value).map(flattenForSearch).join(' ');
  return '';
};

const getListingSearchText = (listing, scope = 'all') => {
  const listingPayload = parseJsonObject(
    listing?.ListingJson ||
    listing?.listingJson ||
    listing?.ListingData ||
    listing?.listingData ||
    listing?.PropertyJson ||
    listing?.propertyJson ||
    listing?.RawListingJson ||
    listing?.rawListingJson
  );
  const nestedListing = listing?.listing || listing?.Listing;
  const source = {
    ...(listingPayload || {}),
    ...(nestedListing || {}),
    ...(listing || {}),
  };
  const additionalInfo = parseJsonObject(
    source?.AdditionalInfo ||
    source?.additionalInfo ||
    source?.additional_info ||
    source?.AdditionalInformation ||
    source?.additionalInformation ||
    source?.additional_information
  );
  const detailFields = [
    source?.Description,
    source?.description,
    source?.description_html,
    source?.Summary,
    source?.summary,
    source?.ShortDescription,
    source?.shortDescription,
    source?.short_description,
    source?.Features,
    source?.features,
    source?.KeyFeatures,
    source?.keyFeatures,
    source?.key_features,
    source?.BulletPoints,
    source?.bulletPoints,
    source?.bullet_points,
    source?.Highlights,
    source?.highlights,
    source?.Amenities,
    source?.amenities,
    source?.OutdoorFeatures,
    source?.outdoorFeatures,
    source?.outdoor_features,
    source?.OutsideSpace,
    source?.outsideSpace,
    source?.outside_space,
    source?.Garden,
    source?.garden,
    source?.Parking,
    source?.parking,
    source?.ParkingDetails,
    source?.parkingDetails,
    source?.parking_details,
    source?.Tenure,
    source?.tenure,
    source?.Ownership,
    source?.ownership,
    source?.PropertyTimeline,
    source?.propertyTimeline,
    source?.property_timeline,
    source?.NearbyStations,
    source?.nearbyStations,
    source?.nearby_stations,
    source?.NearbySchools,
    source?.nearbySchools,
    source?.nearby_schools,
    additionalInfo,
  ];
  const fields = scope === 'details' ? detailFields : [
    source?.Title,
    source?.title,
    source?.Description,
    source?.description,
    source?.description_html,
    source?.PropertyType,
    source?.propertyType,
    source?.property_type,
    source?.ListingType,
    source?.listingType,
    source?.listing_type,
    source?.Status,
    source?.status,
    source?.PropertyStatus,
    source?.propertyStatus,
    source?.property_status,
    source?.Tenure,
    source?.tenure,
    source?.Ownership,
    source?.ownership,
    source?.Features,
    source?.features,
    source?.KeyFeatures,
    source?.keyFeatures,
    source?.key_features,
    source?.BulletPoints,
    source?.bulletPoints,
    source?.bullet_points,
    source?.Highlights,
    source?.highlights,
    source?.Amenities,
    source?.amenities,
    source?.OutdoorFeatures,
    source?.outdoorFeatures,
    source?.outdoor_features,
    source?.OutsideSpace,
    source?.outsideSpace,
    source?.outside_space,
    source?.Garden,
    source?.garden,
    source?.Parking,
    source?.parking,
    source?.ParkingDetails,
    source?.parkingDetails,
    source?.parking_details,
    source?.Postcode,
    source?.postcode,
    source?.Address,
    source?.address,
    source?.EPCRating,
    source?.epcRating,
    source?.epc_rating,
    source?.PropertyTimeline,
    source?.propertyTimeline,
    source?.property_timeline,
    source?.NearbyStations,
    source?.nearbyStations,
    source?.nearby_stations,
    source?.NearbySchools,
    source?.nearbySchools,
    source?.nearby_schools,
    additionalInfo,
  ];

  return fields.map(flattenForSearch).join(' ').toLowerCase();
};

const matchesTerms = (listing, terms = [], scope = 'all') => {
  const searchText = getListingSearchText(listing, scope);
  return terms.some((term) => searchText.includes(term.toLowerCase()));
};

const getListingDate = (listing) => {
  const possibleDates = [
    listing?.DateScraped,
    listing?.dateScraped,
    listing?.AddedOn,
    listing?.addedOn,
    listing?.CreatedAt,
    listing?.createdAt,
    listing?.ListedAt,
    listing?.listedAt,
  ];

  for (const value of possibleDates) {
    if (!value) continue;
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  }

  return null;
};

const listingPassesDeckFilters = (listing, filters) => {
  const propertyType = PROPERTY_TYPE_OPTIONS.find((item) => item.key === filters.propertyType);
  if (propertyType?.key !== 'all' && !matchesTerms(listing, propertyType?.terms)) return false;

  for (const item of SPECIAL_FILTERS) {
    const mode = filters.special?.[item.key] || 'include';
    const hasMatch = matchesTerms(listing, item.terms);
    if (mode === 'exclude' && hasMatch) return false;
    if (mode === 'only' && !hasMatch) return false;
  }

  for (const key of filters.mustHaves || []) {
    const item = MUST_HAVE_FILTERS.find((filter) => filter.key === key);
    if (item && !matchesTerms(listing, item.terms, item.searchScope)) return false;
  }

  const ownership = OWNERSHIP_OPTIONS.find((item) => item.key === filters.ownership);
  if (ownership?.key !== 'all' && !matchesTerms(listing, ownership?.terms)) return false;

  if (filters.statuses?.length) {
    const matchesAnyStatus = filters.statuses.some((key) => {
      const item = STATUS_FILTERS.find((filter) => filter.key === key);
      return item ? matchesTerms(listing, item.terms) : false;
    });

    if (!matchesAnyStatus) return false;
  }

  const feature = FEATURE_OPTIONS.find((item) => item.key === filters.feature);
  if (feature?.key !== 'all' && !matchesTerms(listing, feature?.terms)) return false;

  const added = SHOW_DATE_ADDED_FILTER ? ADDED_OPTIONS.find((item) => item.key === filters.added) : null;
  if (added?.days) {
    const listingDate = getListingDate(listing);
    if (!listingDate) return false;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - added.days);
    if (listingDate < cutoffDate) return false;
  }

  return true;
};

const getNumericValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const numberValue = Number(String(value).replace(/[£,\s]/g, ''));
    if (Number.isFinite(numberValue)) return numberValue;
  }

  return null;
};

const getDistanceMiles = (listing) => getNumericValue(
  listing?.distanceMiles,
  listing?.DistanceMiles,
  listing?.searchDistanceMiles,
  listing?.SearchDistanceMiles
);

const formatSearchDistance = (listing) => {
  const distanceMiles = getDistanceMiles(listing);
  if (distanceMiles === null) return '';

  const formattedDistance = distanceMiles.toFixed(2);

  return `${formattedDistance} miles from your search location`;
};

const isDeckDeleted = (deck) => {
  const status = String(deck?.deckStatus || deck?.DeckStatus || deck?.status || deck?.Status || '').toLowerCase();
  const deletedFlag = deck?.isDeleted ?? deck?.IsDeleted;
  const isDeletedFlag = deletedFlag === true || deletedFlag === 1 || String(deletedFlag).toLowerCase() === 'true';
  return Boolean(
    isDeletedFlag ||
    deck?.deletedAt ||
    deck?.DeletedAt ||
    status === 'deleted' ||
    status === 'archived'
  );
};

const getDeckActionErrorMessage = (error) => (
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  'The backend did not complete the request.'
);

const getListingRating = (listing) => {
  const directRating = getNumericValue(
    listing?.generalPropertyRating,
    listing?.GeneralPropertyRating
  );
  if (directRating !== null) return clampRating(directRating > 1 ? directRating : directRating * 100);

  const imageCount = normalizeImageUrls(listing).length;
  const hasPrice = Boolean(listing?.Price || listing?.price);
  const hasBeds = Boolean(listing?.Beds || listing?.beds || listing?.Bedrooms || listing?.bedrooms);
  const hasBaths = Boolean(listing?.Baths || listing?.baths || listing?.Bathrooms || listing?.bathrooms);
  const hasDescription = Boolean(listing?.Description || listing?.description);
  const hasLocation = Boolean(
    listing?.Latitude || listing?.latitude || listing?.Longitude || listing?.longitude || listing?.Address || listing?.address
  );

  return clampRating(
    35 +
    (hasPrice ? 15 : 0) +
    (hasBeds ? 10 : 0) +
    (hasBaths ? 8 : 0) +
    (hasDescription ? 12 : 0) +
    (hasLocation ? 10 : 0) +
    Math.min(imageCount, 4) * 3
  );
};

const getUserMatchRating = (listing) => {
  const directScore = getNumericValue(
    listing?.userPropertyRating,
    listing?.UserPropertyRating,
    listing?.MatchScore,
    listing?.matchScore,
    listing?.UserMatchScore,
    listing?.userMatchScore
  );
  if (directScore !== null) return clampRating(directScore > 1 ? directScore : directScore * 100);

  const metrics = parseJsonObject(listing?.MetricsJson || listing?.metricsJson);
  if (metrics) {
    const scores = Object.values(metrics)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (scores.length) {
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return clampRating(average > 1 ? average : average * 100);
    }
  }

  return clampRating(getListingRating(listing) - 7);
};

const formatRank = (rank) => {
  const numericRank = getNumericValue(rank);
  return numericRank !== null && numericRank > 0 ? `#${Math.round(numericRank)}` : null;
};

const formatPercentage = (score) => {
  const numericScore = getNumericValue(score);
  if (numericScore === null) return null;

  return `${clampRating(numericScore > 1 ? numericScore : numericScore * 100)}%`;
};

const getRankNumber = (listing, rankKey) => {
  const rank = rankKey === 'yourFit'
    ? getNumericValue(listing?.yourFitRank, listing?.YourFitRank)
    : getNumericValue(listing?.propertyRank, listing?.PropertyRank);

  return rank !== null && rank > 0 ? rank : Number.POSITIVE_INFINITY;
};

const getDeckShortlistCount = (deck) => {
  const shortlistCount = getNumericValue(deck?.shortlistCount, deck?.ShortlistCount);
  if (shortlistCount !== null) return shortlistCount;
  return Array.isArray(deck?.shortlist) ? deck.shortlist.length : 0;
};

const getBackendRankGroupOrder = (listing) => {
  const breakdown = parseJsonObject(listing?.scoreBreakdownJson || listing?.ScoreBreakdownJson);
  const group = breakdown?.personalised?.rankGroup || breakdown?.rankGroup || breakdown?.final?.rankGroup;
  const order = getNumericValue(group?.order);
  if (order !== null) return order;

  const key = String(group?.key || group || '').toUpperCase();
  if (key === 'A') return 1;
  if (key === 'B') return 2;
  if (key === 'C') return 3;
  if (key === 'D') return 4;
  return Number.POSITIVE_INFINITY;
};

export default function PropertyDeckScreen({ route }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentTier, userProfile } = useSubscription();
  const pan = useRef(new Animated.ValueXY()).current;
  const isProcessingRef = useRef(false);
  const handledOpenDeckIdRef = useRef(null);
  const fullListingCacheRef = useRef(new Map());
  const isEnrichingDeckListingsRef = useRef(false);
  const lastRichFilterEnrichmentKeyRef = useRef(null);
  const shortlistRemovalTimersRef = useRef(new Map());
  const loadedDeckContentIdRef = useRef(null);
  const buyScrollRef = useRef(null);
  const buyerAssistantSectionYRef = useRef(0);
  const buyerAssistantSuccessTimerRef = useRef(null);
  const [mode, setMode] = useState('list');
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [deckListings, setDeckListings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewListing, setPreviewListing] = useState(null);
  const [editingDeckId, setEditingDeckId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [deckFilters, setDeckFilters] = useState(createDefaultDeckFilters);
  const [shortlistSortMode, setShortlistSortMode] = useState('yourFit');
  const [pendingShortlistRemovals, setPendingShortlistRemovals] = useState({});
  const [buyerAssistantMode, setBuyerAssistantMode] = useState('offer');
  const [buyerAssistantInput, setBuyerAssistantInput] = useState('');
  const [buyerAssistantResult, setBuyerAssistantResult] = useState(null);
  const [buyerAssistantLoading, setBuyerAssistantLoading] = useState(false);
  const [buyerAssistantError, setBuyerAssistantError] = useState('');
  const [buyerAssistantSuccess, setBuyerAssistantSuccess] = useState('');
  const [buyerWorkspaceContext, setBuyerWorkspaceContext] = useState(null);
  const [buyChecklistProgress, setBuyChecklistProgress] = useState({});

  const deckLimit = getPropertyDeckLimit(currentTier);
  const selectedDeck = decks.find((deck) => String(deck.id) === String(selectedDeckId)) || null;
  const selectedShortlist = selectedDeck?.shortlist || [];
  const hasYourFitRanks = selectedShortlist.some((listing) => getRankNumber(listing, 'yourFit') !== Number.POSITIVE_INFINITY);
  const activeShortlistSortMode = shortlistSortMode === 'yourFit' && hasYourFitRanks ? 'yourFit' : 'overall';
  const sortedShortlist = useMemo(() => (
    [...selectedShortlist].sort((left, right) => {
      const leftRank = getRankNumber(left, activeShortlistSortMode);
      const rightRank = getRankNumber(right, activeShortlistSortMode);

      if (activeShortlistSortMode === 'yourFit') {
        const leftGroup = getBackendRankGroupOrder(left);
        const rightGroup = getBackendRankGroupOrder(right);
        const hasMissingRank = !Number.isFinite(leftRank) || !Number.isFinite(rightRank);

        if (hasMissingRank) {
          if (leftGroup !== rightGroup) return leftGroup - rightGroup;

          const scoreDiff = getUserMatchRating(right) - getUserMatchRating(left);
          if (scoreDiff !== 0) return scoreDiff;
        }
      }

      if (leftRank !== rightRank) return leftRank - rightRank;

      return getUserMatchRating(right) - getUserMatchRating(left);
    })
  ), [activeShortlistSortMode, selectedShortlist]);
  const pendingRemovalIds = Object.keys(pendingShortlistRemovals);
  const visibleShortlist = useMemo(() => (
    sortedShortlist.filter((listing) => {
      const listingId = getListingId(listing);
      const shortlistListingId = listing.shortListListingId || listing.ShortListListingId || listing.ShortListListingID || listing.shortlistListingId;
      return !(
        (listingId && pendingShortlistRemovals[listingId]) ||
        (shortlistListingId && pendingShortlistRemovals[shortlistListingId])
      );
    })
  ), [pendingShortlistRemovals, sortedShortlist]);
  const activeDecks = decks.filter((deck) => !isDeckDeleted(deck));
  const deletedDecks = decks.filter(isDeckDeleted);
  const filteredDeckListings = useMemo(
    () => deckListings.filter((listing) => listingPassesDeckFilters(listing, deckFilters)),
    [deckFilters, deckListings]
  );
  const currentListing = filteredDeckListings[currentIndex];
  const canCreateDeck = deckLimit > 0 && decks.length < deckLimit;
  const buyerWorkspaceItemId = buyerWorkspaceContext?.buyerWorkspaceItemId || buyerWorkspaceContext?.id || null;

  const loadDecks = useCallback(async () => {
    setLoading(true);
    let nextDecks = [];

    try {
      nextDecks = await getPropertyDecks(userProfile);
    } catch (error) {
      console.log('[PROPERTY-DECK] load decks failed:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }

    setDecks((currentDecks) => nextDecks.map((nextDeck) => {
      const currentDeck = currentDecks.find((deck) => String(deck.id) === String(nextDeck.id));
      if (!currentDeck) return nextDeck;

      const currentShortlist = Array.isArray(currentDeck.shortlist) ? currentDeck.shortlist : [];
      return currentShortlist.length
        ? { ...nextDeck, shortlist: currentShortlist, shortlistCount: currentShortlist.length }
        : { ...nextDeck, shortlist: currentDeck.shortlist || [], shortlistCount: getDeckShortlistCount(nextDeck) };
    }));

    if (selectedDeckId && !nextDecks.some((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(null);
      setMode('list');
    }

    setLoading(false);
  }, [selectedDeckId, userProfile]);

  const loadSelectedDeck = useCallback(async (deckId) => {
    if (!deckId) return;

    let nextDecks = [];
    let nextListings = [];
    let nextShortlist = [];
    let deckSummary = null;

    try {
      nextDecks = await getPropertyDecks(userProfile);
      deckSummary = nextDecks.find((deck) => String(deck.id) === String(deckId)) || null;
      setDecks((currentDecks) => nextDecks.map((deck) => {
        const currentDeck = currentDecks.find((item) => String(item.id) === String(deck.id));
        const currentShortlist = Array.isArray(currentDeck?.shortlist) ? currentDeck.shortlist : [];
        return currentShortlist.length
          ? { ...deck, shortlist: currentShortlist, shortlistCount: currentShortlist.length }
          : { ...deck, shortlist: currentDeck?.shortlist || [], shortlistCount: getDeckShortlistCount(deck) };
      }));
    } catch (error) {
      console.log('[PROPERTY-DECK] load selected deck list failed:', {
        deckId,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }

    try {
      [nextListings, nextShortlist] = await Promise.all([
        getMatchedDeckListings(deckId, userProfile, deckSummary),
        getShortlist(deckId, userProfile, deckSummary),
      ]);
    } catch (error) {
      console.log('[PROPERTY-DECK] load selected deck content failed:', {
        deckId,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      Alert.alert('Could not load Property Deck listings', getDeckActionErrorMessage(error));
    }

    setDecks((currentDecks) => nextDecks.map((deck) => {
      const currentDeck = currentDecks.find((item) => String(item.id) === String(deck.id));
      if (String(deck.id) === String(deckId)) {
        return { ...deck, shortlist: nextShortlist, shortlistCount: nextShortlist.length };
      }
      const currentShortlist = Array.isArray(currentDeck?.shortlist) ? currentDeck.shortlist : [];
      return currentShortlist.length
        ? { ...deck, shortlist: currentShortlist, shortlistCount: currentShortlist.length }
        : { ...deck, shortlist: currentDeck?.shortlist || [], shortlistCount: getDeckShortlistCount(deck) };
    }));
    setDeckListings(nextListings);
    loadedDeckContentIdRef.current = String(deckId);
    lastRichFilterEnrichmentKeyRef.current = null;
    setCurrentIndex(0);
    pan.setValue({ x: 0, y: 0 });
  }, [pan, userProfile]);

  useEffect(() => {
    setCurrentIndex(0);
    pan.setValue({ x: 0, y: 0 });
  }, [deckFilters, pan]);

  useEffect(() => () => {
    shortlistRemovalTimersRef.current.forEach((timer) => clearTimeout(timer));
    shortlistRemovalTimersRef.current.clear();
    if (buyerAssistantSuccessTimerRef.current) {
      clearTimeout(buyerAssistantSuccessTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (
      !deckFiltersNeedRichListingData(deckFilters) ||
      !deckListings.length ||
      filteredDeckListings.length ||
      isEnrichingDeckListingsRef.current
    ) {
      return;
    }

    const enrichmentKey = [
      selectedDeckId || 'deck',
      deckFilters.mustHaves?.join(',') || 'none',
      deckFilters.ownership || 'all',
      deckListings.map((listing) => getListingId(listing)).join(','),
    ].join('|');

    if (lastRichFilterEnrichmentKeyRef.current === enrichmentKey) {
      return;
    }

    let isCancelled = false;
    isEnrichingDeckListingsRef.current = true;
    lastRichFilterEnrichmentKeyRef.current = enrichmentKey;

    const enrichDeckListings = async () => {
      const enrichedListings = [...deckListings];
      let enrichedMatchCount = 0;

      for (let index = 0; index < deckListings.length; index += 1) {
        if (isCancelled) break;

        const listing = deckListings[index];
        const listingId = getListingId(listing);
        if (!listingId) {
          continue;
        }

        try {
          let fullListing = fullListingCacheRef.current.get(listingId);
          if (!fullListing) {
            const result = await getListingById(listingId);
            fullListing = result?.listing || result?.Listing || result;
            if (fullListing) fullListingCacheRef.current.set(listingId, fullListing);
          }

          const enrichedListing = getDisplayListing({
            ...listing,
            ...(fullListing || {}),
            propertyDeckListingId: listing.propertyDeckListingId,
            status: listing.status,
            distanceMiles: listing.distanceMiles,
            SearchDistanceMiles: listing.SearchDistanceMiles,
          });

          enrichedListings[index] = enrichedListing;
          if (listingPassesDeckFilters(enrichedListing, deckFilters)) {
            enrichedMatchCount += 1;
            if (enrichedMatchCount >= RICH_FILTER_ENRICHMENT_MATCH_LIMIT) break;
          }
        } catch {
          enrichedListings[index] = listing;
        }
      }

      if (!isCancelled) {
        setDeckListings(enrichedListings);
      }
    };

    enrichDeckListings().finally(() => {
      isEnrichingDeckListingsRef.current = false;
    });

    return () => {
      isCancelled = true;
    };
  }, [deckFilters, deckListings, filteredDeckListings.length]);

  useFocusEffect(
    useCallback(() => {
      const routeDeckId = route?.params?.openDeckId;
      const routeOpenMode = ROUTE_FLOW_MODES.has(route?.params?.openMode) ? route.params.openMode : 'detail';
      const routeOpenKey = routeDeckId ? `${routeDeckId}:${routeOpenMode}` : null;
      const routeBuyerContext = route?.params?.buyerWorkspaceContext || null;

      if (routeBuyerContext) {
        setBuyerWorkspaceContext(routeBuyerContext);
      }

      if (routeDeckId && handledOpenDeckIdRef.current !== routeOpenKey) {
        handledOpenDeckIdRef.current = routeOpenKey;
        setSelectedDeckId(routeDeckId);
        setMode(routeOpenMode);
        loadSelectedDeck(routeDeckId);
        navigation.setParams?.({ openDeckId: undefined, openMode: undefined, buyerWorkspaceContext: undefined });
        return;
      }

      if (!routeDeckId && ROUTE_FLOW_MODES.has(route?.params?.openMode)) {
        setMode(routeOpenMode);
        navigation.setParams?.({ openMode: undefined, buyerWorkspaceContext: undefined });
      }

      if ((mode === 'detail' || mode === 'shortlist') && selectedDeckId) {
        if (loadedDeckContentIdRef.current !== String(selectedDeckId)) {
          loadSelectedDeck(selectedDeckId);
        }
      } else {
        loadDecks();
      }
    }, [loadDecks, loadSelectedDeck, mode, navigation, route?.params?.buyerWorkspaceContext, route?.params?.openDeckId, route?.params?.openMode, selectedDeckId])
  );

  const cardStyle = useMemo(() => {
    const rotate = pan.x.interpolate({
      inputRange: [-200, 0, 200],
      outputRange: ['-7deg', '0deg', '7deg'],
    });

    return {
      transform: [
        { translateX: pan.x },
        { translateY: pan.y },
        { rotate },
      ],
    };
  }, [pan]);

  const openDeck = async (deckId) => {
    setSelectedDeckId(deckId);
    setMode('detail');
    if (loadedDeckContentIdRef.current !== String(deckId)) {
      await loadSelectedDeck(deckId);
    }
  };

  const openListingPreview = (listing) => {
    setPreviewListing(getDisplayListing(listing));
  };

  const openFullListing = async (listing) => {
    let displayListing = getDisplayListing(listing);
    const listingId = getListingId(displayListing);

    if (listingId && !hasDescriptionText(displayListing)) {
      try {
        console.log('[PROPERTY-DECK] loading full listing details:', {
          listingId,
          currentKeys: displayListing && typeof displayListing === 'object' ? Object.keys(displayListing) : [],
        });
        const fullListing = await getListingById(listingId);
        displayListing = getDisplayListing({
          ...displayListing,
          ...(fullListing?.listing || fullListing?.Listing || fullListing),
        });
        console.log('[PROPERTY-DECK] full listing details merged:', {
          listingId,
          hasDescription: Boolean(displayListing?.Description),
          hasAdditionalInfo: Boolean(displayListing?.AdditionalInfo),
          keys: displayListing && typeof displayListing === 'object' ? Object.keys(displayListing) : [],
        });
      } catch (error) {
        console.log('[PROPERTY-DECK] full listing detail fetch failed:', {
          listingId,
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
      }
    }

    setPreviewListing(null);
    navigation.navigate('ListingDetail', { listing: displayListing });
  };

  const handleCreateDeck = async () => {
    if (!canCreateDeck) {
      return;
    }

    Alert.alert(
      'Create from Map',
      'Property Decks are created from the current map radius so the deck can be populated with matching listings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Map', onPress: () => navigation.navigate('Map') },
      ]
    );
  };

  const setDeckFilterValue = (key, value) => {
    setDeckFilters((filters) => ({ ...filters, [key]: value }));
  };

  const toggleArrayFilter = (key, value) => {
    setDeckFilters((filters) => {
      const values = Array.isArray(filters[key]) ? filters[key] : [];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];

      return { ...filters, [key]: nextValues };
    });
  };

  const setSpecialFilterMode = (key, mode) => {
    setDeckFilters((filters) => ({
      ...filters,
      special: {
        ...filters.special,
        [key]: mode,
      },
    }));
  };

  const resetDeckFilters = () => {
    setDeckFilters(createDefaultDeckFilters());
  };

  const renderChoiceChips = (options, selectedKey, onSelect) => (
    <View style={styles.filterChipWrap}>
      {options.map((option) => {
        const isSelected = selectedKey === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            onPress={() => onSelect(option.key)}
          >
            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderToggleChips = (options, selectedValues, onToggle) => (
    <View style={styles.filterChipWrap}>
      {options.map((option) => {
        const isSelected = (selectedValues || []).includes(option.key);
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            onPress={() => onToggle(option.key)}
          >
            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFilterSection = (title, children) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const startRename = (deck) => {
    setEditingDeckId(deck.id);
    setEditingName(deck.name);
  };

  const saveRename = async () => {
    const nextDecks = await renamePropertyDeck(editingDeckId, editingName, userProfile);
    setDecks(nextDecks);
    setEditingDeckId(null);
    setEditingName('');
  };

  const completeSwipe = useCallback(async (direction) => {
    if (!selectedDeckId || !currentListing || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const listing = currentListing;
    const listingId = getListingId(listing);
    const deckId = selectedDeckId;

    if (direction === 'right') {
      setDecks((currentDecks) => currentDecks.map((deck) => {
        if (deck.id !== deckId) return deck;

        const currentShortlist = Array.isArray(deck.shortlist) ? deck.shortlist : [];
        const alreadyShortlisted = currentShortlist.some((item) => getListingId(item) === listingId);
        const shortlist = alreadyShortlisted
          ? currentShortlist
          : [{ ...listing, shortlistedAt: Date.now() }, ...currentShortlist];

        return {
          ...deck,
          shortlist,
          shortlistCount: shortlist.length,
        };
      }));
    }

    Animated.timing(pan, {
      toValue: { x: direction === 'left' ? -420 : 420, y: 0 },
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setCurrentIndex((index) => index + 1);
      setPreviewListing(null);
      isProcessingRef.current = false;
    });

    (async () => {
      try {
        let rankedShortlist = null;
        if (direction === 'left') {
          await dismissDeckListing(deckId, listingId, userProfile);
        } else {
          rankedShortlist = await saveToShortlist(deckId, listing, userProfile);
        }

        if (rankedShortlist) {
          setDecks((currentDecks) => currentDecks.map((deck) => (
            String(deck.id) === String(deckId)
              ? { ...deck, shortlist: rankedShortlist, shortlistCount: rankedShortlist.length }
              : deck
          )));
        } else {
          const nextDecks = await getPropertyDecks(userProfile);
          setDecks((currentDecks) => nextDecks.map((nextDeck) => {
            const currentDeck = currentDecks.find((deck) => String(deck.id) === String(nextDeck.id));
            return currentDeck?.shortlist
              ? { ...nextDeck, shortlist: currentDeck.shortlist, shortlistCount: currentDeck.shortlist.length }
              : nextDeck;
          }));
        }
      } catch (error) {
        console.log('[PROPERTY-DECK] swipe action failed:', {
          direction,
          deckId,
          listingId,
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
      }
    })();
  }, [currentListing, pan, selectedDeckId, userProfile]);

  const handlePreviewDecision = async (direction) => {
    if (!previewListing) return;

    const previewListingId = getListingId(previewListing);
    const currentListingId = getListingId(currentListing);

    if (previewListingId && previewListingId === currentListingId) {
      await completeSwipe(direction);
      return;
    }

    setPreviewListing(null);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8
    ),
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -SWIPE_THRESHOLD) {
        completeSwipe('left');
        return;
      }

      if (gesture.dx > SWIPE_THRESHOLD) {
        completeSwipe('right');
        return;
      }

      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        useNativeDriver: true,
      }).start();
    },
  }), [completeSwipe, pan]);

  const handleRemoveFromShortlist = (listingId) => {
    if (!selectedDeckId || !listingId || shortlistRemovalTimersRef.current.has(listingId)) return;

    setPendingShortlistRemovals((current) => ({
      ...current,
      [listingId]: true,
    }));

    const timer = setTimeout(async () => {
      shortlistRemovalTimersRef.current.delete(listingId);

      try {
        await removeFromShortlist(selectedDeckId, listingId, userProfile);
        setDecks((currentDecks) => currentDecks.map((deck) => (
          String(deck.id) === String(selectedDeckId)
            ? {
                ...deck,
                shortlist: (deck.shortlist || []).filter((item) => {
                  const itemListingId = getListingId(item);
                  const itemShortlistId = item.shortListListingId || item.ShortListListingId || item.ShortListListingID || item.shortlistListingId;
                  return String(itemListingId) !== String(listingId) && String(itemShortlistId) !== String(listingId);
                }),
                shortlistCount: Math.max(0, (deck.shortlistCount ?? deck.shortlist?.length ?? 1) - 1),
              }
            : deck
        )));
        setPendingShortlistRemovals((current) => {
          const next = { ...current };
          delete next[listingId];
          return next;
        });
      } catch (error) {
        console.log('[PROPERTY-DECK] remove shortlist item failed:', {
          listingId,
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
        setPendingShortlistRemovals((current) => {
          const next = { ...current };
          delete next[listingId];
          return next;
        });
        Alert.alert('Could not remove from shortlist', getDeckActionErrorMessage(error));
      }
    }, 5000);

    shortlistRemovalTimersRef.current.set(listingId, timer);
  };

  const undoRemoveFromShortlist = (listingId) => {
    const timer = shortlistRemovalTimersRef.current.get(listingId);
    if (timer) clearTimeout(timer);

    shortlistRemovalTimersRef.current.delete(listingId);
    setPendingShortlistRemovals((current) => {
      const next = { ...current };
      delete next[listingId];
      return next;
    });
  };

  const openDecisionBoard = async (listing) => {
    const listingId = getListingId(listing);
    if (!listingId) return;

    navigation.navigate('DecisionBoards', {
      pendingListing: listing,
      pendingSource: {
        shortListListingId: listing.shortListListingId || listing.ShortListListingId || listing.ShortListListingID || listing.shortlistListingId,
        shortListId: listing.shortListId || listing.ShortListID,
        sourceFlow: 'propertyDeck',
        suggestedBoardName: `${selectedDeck?.name || 'Property'} Decisions`,
      },
    });
  };

  const openDecisionBoardsForDeck = () => {
    navigation.navigate('DecisionBoards', {
      pendingSource: {
        sourceFlow: 'propertyDeck',
        propertyDeckId: selectedDeckId,
        suggestedBoardName: `${selectedDeck?.name || 'Property'} Decisions`,
      },
    });
  };

  const goBackFromBuy = () => {
    if (buyerWorkspaceContext && buyerContextBoard?.id) {
      navigation.navigate('DecisionBoard', {
        decisionBoardId: buyerContextBoard.id,
        decisionBoard: buyerContextBoard,
      });
      return;
    }

    if (buyerWorkspaceContext) {
      openDecisionBoardsForDeck();
      return;
    }

    setMode('shortlist');
  };

  const handleFlowStepPress = (stepKey) => {
    if (stepKey === 'decision') {
      openDecisionBoardsForDeck();
      return;
    }

    if (stepKey === 'buy') {
      navigation.navigate('Buy');
      return;
    }

    setMode(stepKey);
  };

  const confirmArchiveDeck = (deck) => {
    Alert.alert(
      'Delete Property Deck',
      'This moves the deck, shortlist, and board work into Deleted Property Decks so it can be restored later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextDecks = await archivePropertyDeck(deck.id, userProfile);
              setDecks(nextDecks);
              if (selectedDeckId === deck.id) {
                setSelectedDeckId(null);
                setMode('list');
              }
            } catch (error) {
              Alert.alert('Could not delete deck', getDeckActionErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const handleRestoreDeck = async (deck) => {
    try {
      const nextDecks = await restorePropertyDeck(deck.id, userProfile);
      setDecks(nextDecks);
    } catch (error) {
      Alert.alert('Could not restore deck', getDeckActionErrorMessage(error));
    }
  };

  const confirmDestroyDeck = (deck) => {
    Alert.alert(
      'Destroy Property Deck',
      'This permanently deletes the deck and its shortlist and board records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Destroy',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextDecks = await destroyPropertyDeck(deck.id, userProfile);
              setDecks(nextDecks);
              if (selectedDeckId === deck.id) {
                setSelectedDeckId(null);
                setMode('list');
              }
            } catch (error) {
              Alert.alert('Could not destroy deck', getDeckActionErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const renderFlowSteps = () => {
    const activeIndex = Math.max(0, FLOW_STEPS.findIndex((step) => step.key === mode));

    return (
      <View style={styles.flowStepsContainer}>
        {FLOW_STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <TouchableOpacity
              key={step.key}
              style={styles.flowStepItem}
              onPress={() => handleFlowStepPress(step.key)}
              activeOpacity={0.85}
            >
              <View style={styles.flowStepTopRow}>
                <View
                  style={[
                    styles.flowStepDot,
                    isComplete && styles.flowStepDotComplete,
                    isActive && styles.flowStepDotActive,
                  ]}
                >
                  {isComplete ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.flowStepNumber, isActive && styles.flowStepNumberActive]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                {index < FLOW_STEPS.length - 1 && (
                  <View style={[styles.flowStepLine, index < activeIndex && styles.flowStepLineActive]} />
                )}
              </View>
              <Text style={[styles.flowStepLabel, isActive && styles.flowStepLabelActive]} numberOfLines={1}>
                {step.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderDeckListItem = ({ item }) => {
    const isEditing = editingDeckId === item.id;

    return (
      <TouchableOpacity
        style={styles.deckListItem}
        activeOpacity={0.9}
        onPress={() => !isEditing && openDeck(item.id)}
      >
        <View style={styles.deckListIcon}>
          <Ionicons name="albums" size={24} color={APP_PURPLE} />
        </View>

        <View style={styles.deckListContent}>
          {isEditing ? (
            <TextInput
              value={editingName}
              onChangeText={setEditingName}
              style={styles.deckNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveRename}
            />
          ) : (
            <Text style={styles.deckListTitle} numberOfLines={1}>
              {item.name}
            </Text>
          )}

          <Text style={styles.deckListMeta}>
            {getDeckShortlistCount(item)} shortlisted / created {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={styles.deckListActions}>
          {isEditing ? (
            <TouchableOpacity style={styles.iconButton} onPress={saveRename}>
              <Ionicons name="checkmark" size={22} color={APP_PURPLE} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.iconButton} onPress={() => startRename(item)}>
                <Ionicons name="pencil-outline" size={20} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => confirmArchiveDeck(item)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDeletedDeckItem = ({ item }) => (
    <View style={[styles.deckListItem, styles.deletedDeckListItem]}>
      <View style={[styles.deckListIcon, styles.deletedDeckIcon]}>
        <Ionicons name="trash-outline" size={23} color="#EF4444" />
      </View>

      <View style={styles.deckListContent}>
        <Text style={styles.deckListTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.deckListMeta}>
          Deleted {formatDate(item.deletedAt || item.DeletedAt)} / {item.shortlist?.length || item.shortlistCount || 0} shortlisted
        </Text>
      </View>

      <View style={styles.deletedDeckActions}>
        <TouchableOpacity style={styles.restoreButton} onPress={() => handleRestoreDeck(item)}>
          <Ionicons name="refresh" size={16} color={APP_PURPLE} />
          <Text style={styles.restoreButtonText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.destroyButton} onPress={() => confirmDestroyDeck(item)}>
          <Ionicons name="close-circle" size={16} color="#FFFFFF" />
          <Text style={styles.destroyButtonText}>Destroy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderListScreen = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Property Decks</Text>
          <Text style={styles.subtitle}>
            {decks.length} of {deckLimit} decks used on {String(currentTier || 'free')} tier.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.createButton, !canCreateDeck && styles.disabledCreateButton]}
          disabled={!canCreateDeck}
          onPress={handleCreateDeck}
        >
          <Ionicons name="add" size={20} color={canCreateDeck ? '#FFFFFF' : '#94A3B8'} />
        </TouchableOpacity>
      </View>

      {deckLimit === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={44} color="#C7CDD8" />
          <Text style={styles.emptyTitle}>Property Decks are a paid feature</Text>
          <Text style={styles.emptyText}>
            Prospector includes 1 deck, Investor includes 5, and Developer includes 10.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeDecks}
          renderItem={renderDeckListItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.deckList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={44} color="#C7CDD8" />
              <Text style={styles.emptyTitle}>
                {loading ? 'Loading decks' : 'No active property decks yet'}
              </Text>
              {!loading && (
                <Text style={styles.emptyText}>
                  Create one from the map when you are ready to save matched properties.
                </Text>
              )}
            </View>
          }
          ListFooterComponent={
            deletedDecks.length ? (
              <View style={styles.deletedSection}>
                <View style={styles.deletedSectionHeader}>
                  <Text style={styles.deletedSectionTitle}>Deleted Property Decks</Text>
                  <Text style={styles.deletedSectionMeta}>{deletedDecks.length}</Text>
                </View>
                {deletedDecks.map((deck) => (
                  <View key={deck.id}>
                    {renderDeletedDeckItem({ item: deck })}
                  </View>
                ))}
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );

  const renderDeckCard = () => {
    if (!currentListing) {
      const filtersHaveNoMatches = deckListings.length > 0 && filteredDeckListings.length === 0;

      return (
        <View style={styles.detailEmptyState}>
          <Ionicons
            name={filtersHaveNoMatches ? 'filter-outline' : 'checkmark-circle-outline'}
            size={38}
            color={APP_PURPLE}
          />
          <Text style={styles.emptyTitle}>
            {filtersHaveNoMatches ? 'No listings match these filters' : 'Deck cleared'}
          </Text>
          <Text style={styles.emptyText}>
            {filtersHaveNoMatches
              ? 'Adjust or reset the Property Deck filters to bring listings back into the swipe flow.'
              : 'New matched properties from notifications will appear here.'}
          </Text>
        </View>
      );
    }

    const imageUrl = normalizeImageUrls(currentListing)[0];
    const distanceText = formatSearchDistance(currentListing);
    const listingId = getListingId(currentListing) || currentListing?.ID || currentListing?.id || currentIndex;
    const deckCardKey = `${currentIndex}-${listingId}-${imageUrl || 'no-image'}`;

    return (
      <>
        <Animated.View
          key={deckCardKey}
          style={[styles.deckCard, cardStyle]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity activeOpacity={0.92} onPress={() => openListingPreview(currentListing)}>
            {imageUrl ? (
              <Image key={deckCardKey} source={{ uri: imageUrl }} style={styles.deckImage} />
            ) : (
              <View key={deckCardKey} style={[styles.deckImage, styles.placeholderImage]}>
                <Ionicons name="home-outline" size={40} color="#C7CDD8" />
              </View>
            )}

            <View style={styles.deckContent}>
              <Text style={styles.deckPrice}>{formatPrice(currentListing.Price)}</Text>
              {!!distanceText && (
                <Text style={styles.distanceText} numberOfLines={1}>{distanceText}</Text>
              )}
              <Text style={styles.deckTitle} numberOfLines={2}>
                {currentListing.Title || currentListing.Address || 'Property match'}
              </Text>
              <Text style={styles.deckMeta} numberOfLines={1}>
                {[currentListing.Beds && `${currentListing.Beds} beds`, currentListing.Baths && `${currentListing.Baths} baths`, currentListing.PropertyType]
                  .filter(Boolean)
                  .join(' / ')}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={() => completeSwipe('left')}
          >
            <Ionicons name="close" size={20} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shortlistButton]}
            onPress={() => completeSwipe('right')}
          >
            <Ionicons name="albums" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderShortlistItem = ({ item, index }) => {
    const imageUrl = normalizeImageUrls(item)[0];
    const listingId = getListingId(item);
    const shortlistDeleteId = item.shortListListingId || item.ShortListListingId || item.ShortListListingID || item.shortlistListingId || listingId;
    const isPendingRemoval = Boolean(
      (listingId && pendingShortlistRemovals[listingId]) ||
      (shortlistDeleteId && pendingShortlistRemovals[shortlistDeleteId])
    );
    const propertyRank = formatRank(item.propertyRank ?? item.PropertyRank);
    const yourFitRank = formatRank(item.yourFitRank ?? item.YourFitRank);
    const propertyRating = propertyRank || getListingRating(item);
    const userRating = activeShortlistSortMode === 'yourFit' ? `#${index + 1}` : (yourFitRank || getUserMatchRating(item));
    const matchScore = formatPercentage(item.matchScore ?? item.MatchScore);
    const confidenceScore = formatPercentage(item.confidenceScore ?? item.ConfidenceScore);
    const rankingMeta = [matchScore && `${matchScore} match`, confidenceScore && `${confidenceScore} confidence`]
      .filter(Boolean)
      .join(' / ');
    const distanceText = formatSearchDistance(item);

    return (
      <TouchableOpacity
        style={[styles.shortlistItem, isPendingRemoval && styles.shortlistItemPendingRemoval]}
        activeOpacity={0.9}
        onPress={() => {
          if (!isPendingRemoval) openListingPreview(item);
        }}
        onLongPress={() => {
          if (!isPendingRemoval) openFullListing(item);
        }}
      >
        <Text style={styles.shortlistRank}>#{index + 1}</Text>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.shortlistImage} />
        ) : (
          <View style={[styles.shortlistImage, styles.placeholderImage]}>
            <Ionicons name="home-outline" size={22} color="#C7CDD8" />
          </View>
        )}

        <View style={styles.shortlistContent}>
          <Text style={styles.shortlistPrice}>{formatPrice(item.Price)}</Text>
          {!!distanceText && (
            <Text style={styles.distanceText} numberOfLines={1}>{distanceText}</Text>
          )}
          <Text style={styles.shortlistTitle} numberOfLines={2}>
            {item.Title || item.Address || 'Shortlisted property'}
          </Text>
          <View style={styles.shortlistScoreRow}>
            <View style={styles.compactScorePill}>
              <Text style={styles.compactScoreLabel}>Overall</Text>
              <Text style={styles.compactScoreValue}>{propertyRating}</Text>
            </View>
            <View style={[styles.compactScorePill, styles.compactUserScorePill]}>
              <Text style={[styles.compactScoreLabel, styles.compactUserScoreLabel]}>For you</Text>
              <Text style={[styles.compactScoreValue, styles.compactUserScoreValue]}>{userRating}</Text>
            </View>
          </View>
          {!!rankingMeta && (
            <Text style={styles.rankingMetaText} numberOfLines={1}>{rankingMeta}</Text>
          )}
          {!isPendingRemoval && (
            <TouchableOpacity
              style={styles.shortlistDecisionButton}
              onPress={() => openDecisionBoard(item)}
            >
              <Ionicons name="git-branch-outline" size={16} color={APP_PURPLE} />
              <Text style={styles.shortlistDecisionButtonText}>Add to Decision Board</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.shortlistActionColumn}>
          {isPendingRemoval ? (
            <TouchableOpacity
              style={styles.undoRemoveButton}
              onPress={() => undoRemoveFromShortlist(listingId)}
            >
              <Ionicons name="arrow-undo-outline" size={17} color={APP_PURPLE} />
              <Text style={styles.undoRemoveButtonText}>Undo</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveFromShortlist(shortlistDeleteId)}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailScreen = () => (
    <>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('list')}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.detailHeaderText}>
          <Text style={styles.title} numberOfLines={1}>
            {selectedDeck?.name || 'Property Deck'}
          </Text>
          <Text style={styles.subtitle}>
            {[
              getDeckSearchLocationLabel(selectedDeck),
              `${filteredDeckListings.length} of ${deckListings.length} listings`,
              'swipe left to remove, right to shortlist',
            ].filter(Boolean).join(' / ')}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerFilterButton} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="options-outline" size={18} color={APP_PURPLE} />
          <Text style={styles.headerFilterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {renderFlowSteps()}

      <View style={styles.deckFlowContent}>
        <View style={styles.flowStepHeader}>
          <Text style={styles.columnTitle}>Property Deck</Text>
          <Text style={styles.flowCounter}>
            {Math.min(currentIndex + 1, filteredDeckListings.length || 1)} / {filteredDeckListings.length || 0}
          </Text>
        </View>
        {renderDeckCard()}
      </View>

      <TouchableOpacity
        style={styles.flowNextButton}
        onPress={() => setMode('shortlist')}
      >
        <Text style={styles.flowNextButtonText}>
          Shortlist({selectedDeck?.shortlist.length || 0})
        </Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </>
  );

  const renderShortlistScreen = () => (
    <>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('detail')}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.detailHeaderText}>
          <Text style={styles.title} numberOfLines={1}>Shortlist</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Review {visibleShortlist.length} selected listings from {selectedDeck?.name || 'Property Deck'}.
          </Text>
        </View>
      </View>

      {renderFlowSteps()}

      <View style={styles.shortlistSortBar}>
        <Text style={styles.shortlistSortLabel}>Order by</Text>
        <View style={styles.shortlistSortOptions}>
          <TouchableOpacity
            style={[
              styles.shortlistSortOption,
              activeShortlistSortMode === 'yourFit' && styles.shortlistSortOptionActive,
              !hasYourFitRanks && styles.shortlistSortOptionDisabled,
            ]}
            onPress={() => setShortlistSortMode('yourFit')}
            disabled={!hasYourFitRanks}
          >
            <Text
              style={[
                styles.shortlistSortOptionText,
                activeShortlistSortMode === 'yourFit' && styles.shortlistSortOptionTextActive,
                !hasYourFitRanks && styles.shortlistSortOptionTextDisabled,
              ]}
            >
              For you
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.shortlistSortOption,
              activeShortlistSortMode === 'overall' && styles.shortlistSortOptionActive,
            ]}
            onPress={() => setShortlistSortMode('overall')}
          >
            <Text
              style={[
                styles.shortlistSortOptionText,
                activeShortlistSortMode === 'overall' && styles.shortlistSortOptionTextActive,
              ]}
            >
              Overall
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.shortlistBoardButton}
          onPress={openDecisionBoardsForDeck}
        >
          <Ionicons name="git-branch-outline" size={16} color="#FFFFFF" />
          <Text style={styles.shortlistBoardButtonText}>Decision Board</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visibleShortlist}
        renderItem={renderShortlistItem}
        keyExtractor={(item, index) => getListingId(item) || `shortlist-${index}`}
        contentContainerStyle={styles.shortlistScreenList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={44} color="#C7CDD8" />
            <Text style={styles.emptyTitle}>No shortlisted properties yet.</Text>
            <Text style={styles.emptyText}>Go back to the deck and swipe right on listings you want to pursue.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {!!pendingRemovalIds.length && (
        <View style={[styles.shortlistUndoBar, { bottom: Math.max(insets.bottom + 12, 20) }]}>
          <View style={styles.shortlistUndoTextWrap}>
            <Text style={styles.shortlistUndoTitle}>
              {pendingRemovalIds.length === 1 ? 'Removed from shortlist' : `${pendingRemovalIds.length} properties removed`}
            </Text>
            <Text style={styles.shortlistUndoText}>Undo available for 5 seconds.</Text>
          </View>
          <TouchableOpacity
            style={styles.shortlistUndoButton}
            onPress={() => undoRemoveFromShortlist(pendingRemovalIds[0])}
          >
            <Ionicons name="arrow-undo-outline" size={16} color={APP_PURPLE} />
            <Text style={styles.shortlistUndoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

    </>
  );

  const buyerContextBoard = buyerWorkspaceContext?.decisionBoard || null;
  const buyerContextDecisionListing = buyerWorkspaceContext?.decisionBoardListing || null;
  const buyerContextListing = buyerContextDecisionListing?.listing || buyerWorkspaceContext?.listing || null;
  const buyerFocusListing = buyerContextListing || visibleShortlist[0] || selectedShortlist[0] || null;
  const buyerContextTitle = buyerContextBoard?.boardName || buyerContextBoard?.name || selectedDeck?.name || 'Buyer workspace';
  const buyerContextStatus = buyerContextDecisionListing?.listingStatus || buyerContextDecisionListing?.trafficLightStatus || null;
  const buyChecklistStorageKey = `${BUY_CHECKLIST_PROGRESS_KEY}:${buyerWorkspaceItemId || getListingId(buyerFocusListing) || selectedDeckId || 'default'}`;

  useEffect(() => {
    let isCancelled = false;
    const decisionBoardId = buyerContextBoard?.id;
    const decisionBoardListingId = buyerContextDecisionListing?.id;

    const refreshBuyerDecisionContext = async () => {
      if (!decisionBoardId || !decisionBoardListingId) return;

      try {
        const board = await getDecisionBoard(decisionBoardId);
        const listings = board?.listings || board?.Listings || [];
        const refreshedListing = listings.find((item) => String(item.id || item.ID) === String(decisionBoardListingId));

        if (!isCancelled && refreshedListing) {
          setBuyerWorkspaceContext((current) => ({
            ...current,
            decisionBoard: board,
            decisionBoardListing: refreshedListing,
            listing: refreshedListing.listing || refreshedListing.listingSummary || current?.listing,
          }));
        }
      } catch {}
    };

    refreshBuyerDecisionContext();

    return () => {
      isCancelled = true;
    };
  }, [buyerContextBoard?.id, buyerContextDecisionListing?.id]);

  useEffect(() => {
    let isCancelled = false;

    const loadBuyChecklistProgress = async () => {
      try {
        const value = await AsyncStorage.getItem(buyChecklistStorageKey);
        if (!isCancelled) {
          setBuyChecklistProgress(value ? JSON.parse(value) || {} : {});
        }
      } catch {
        if (!isCancelled) setBuyChecklistProgress({});
      }
    };

    loadBuyChecklistProgress();

    return () => {
      isCancelled = true;
    };
  }, [buyChecklistStorageKey]);

  const persistBuyChecklistProgress = async (nextProgress) => {
    setBuyChecklistProgress(nextProgress);
    try {
      await AsyncStorage.setItem(buyChecklistStorageKey, JSON.stringify(nextProgress));
    } catch {}
  };

  const getBuyTaskKey = (stepIndex, taskIndex) => `${stepIndex}:${taskIndex}`;
  const totalBuyTasks = BUY_CHECKLIST.reduce((count, step) => count + step.tasks.length, 0);
  const completedBuyTasks = Object.values(buyChecklistProgress).filter(Boolean).length;
  const buyProgress = totalBuyTasks ? Math.round((completedBuyTasks / totalBuyTasks) * 100) : 0;
  const completedBuySteps = BUY_CHECKLIST.filter((step, stepIndex) => (
    step.tasks.every((_, taskIndex) => buyChecklistProgress[getBuyTaskKey(stepIndex, taskIndex)])
  )).length;
  const activeBuyStep = BUY_CHECKLIST.find((step, stepIndex) => (
    !step.tasks.every((_, taskIndex) => buyChecklistProgress[getBuyTaskKey(stepIndex, taskIndex)])
  )) || BUY_CHECKLIST[BUY_CHECKLIST.length - 1];
  const buyerDecisionMedia = buyerContextDecisionListing?.media || buyerContextDecisionListing?.Media || [];
  const buyerDecisionNotes = buyerContextDecisionListing?.listingNotes || buyerContextDecisionListing?.ListingNotes || [];
  const buyerDecisionTimeline = buyerContextDecisionListing?.timeline || buyerContextDecisionListing?.Timeline || [];
  const buyerDecisionTasks = buyerContextDecisionListing?.tasks || buyerContextDecisionListing?.Tasks || [];
  const buyerDecisionAgents = buyerContextDecisionListing?.agents || buyerContextDecisionListing?.listingAgents || buyerContextDecisionListing?.ListingAgents || [];
  const buyerDecisionBrokers = buyerContextDecisionListing?.brokers || buyerContextDecisionListing?.listingBrokers || buyerContextDecisionListing?.ListingBrokers || [];
  const buyerDecisionPros = buyerContextDecisionListing?.pros || buyerContextDecisionListing?.Pros || buyerFocusListing?.pros || buyerFocusListing?.Pros || [];
  const buyerDecisionCons = buyerContextDecisionListing?.cons || buyerContextDecisionListing?.Cons || buyerFocusListing?.cons || buyerFocusListing?.Cons || [];
  const buyerEvidenceItems = [
    ['Photos', buyerDecisionMedia.filter((item) => getDecisionListingMediaType(item) === 'Photo').length],
    ['Videos', buyerDecisionMedia.filter((item) => getDecisionListingMediaType(item) === 'Video').length],
    ['Voice notes', buyerDecisionMedia.filter((item) => getDecisionListingMediaType(item) === 'Audio').length],
    ['Documents', buyerDecisionMedia.filter((item) => getDecisionListingMediaType(item) === 'Document').length],
    ['Viewing notes', buyerDecisionNotes.length],
    ['Agent notes', buyerDecisionAgents.length],
    ['Broker notes', buyerDecisionBrokers.length],
    ['Timeline events', buyerDecisionTimeline.length],
    ['Open tasks', buyerDecisionTasks.filter((item) => String(getDecisionListingTaskStatus(item)).toLowerCase() !== 'completed').length],
    ['Property pros', Array.isArray(buyerDecisionPros) ? buyerDecisionPros.length : 0],
    ['Property cons', Array.isArray(buyerDecisionCons) ? buyerDecisionCons.length : 0],
  ];

  const toggleBuyTask = (stepIndex, taskIndex) => {
    const taskKey = getBuyTaskKey(stepIndex, taskIndex);
    const nextProgress = {
      ...buyChecklistProgress,
      [taskKey]: !buyChecklistProgress[taskKey],
    };
    persistBuyChecklistProgress(nextProgress);
  };

  const openBuyerDecisionMedia = async (item) => {
    const mediaId = item?.id || item?.ID;
    const fileUrl = item?.fileUrl || item?.FileUrl;
    if (!fileUrl) return;

    try {
      const openUrl = mediaId && buyerContextDecisionListing?.id
        ? await getDecisionBoardMediaOpenUrl(buyerContextDecisionListing.id, mediaId)
        : fileUrl;
      await Linking.openURL(openUrl || fileUrl);
    } catch {
      Alert.alert('Cannot open file', 'This attachment could not be opened from the Buyer Workspace.');
    }
  };

  const renderBuyChecklistItem = (step, index) => {
    const completedTaskCount = step.tasks.filter((_, taskIndex) => buyChecklistProgress[getBuyTaskKey(index, taskIndex)]).length;
    const isComplete = completedTaskCount === step.tasks.length;
    const isInProgress = completedTaskCount > 0 && !isComplete;
    const status = isComplete ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started';
    const statusStyle = isComplete
      ? styles.buyStatusComplete
      : isInProgress
        ? styles.buyStatusInProgress
        : styles.buyStatusNotStarted;

    return (
      <View key={step.title} style={[styles.buyChecklistCard, isComplete && styles.buyChecklistCardComplete]}>
        <View style={styles.buyChecklistHeader}>
          <View style={[styles.buyStepNumber, isComplete && styles.buyStepNumberComplete]}>
            {isComplete ? (
              <Ionicons name="checkmark" size={17} color="#FFFFFF" />
            ) : (
              <Text style={styles.buyStepNumberText}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.buyChecklistTitleWrap}>
            <Text style={[styles.buyChecklistTitle, isComplete && styles.buyChecklistTitleComplete]}>{step.title}</Text>
            <Text style={[styles.buyStatusText, statusStyle]}>{status} / {completedTaskCount}/{step.tasks.length}</Text>
          </View>
        </View>
        <View style={styles.buyTaskList}>
          {step.tasks.map((task, taskIndex) => {
            const isChecked = Boolean(buyChecklistProgress[getBuyTaskKey(index, taskIndex)]);
            return (
              <TouchableOpacity
                key={task}
                style={[styles.buyTaskRow, isChecked && styles.buyTaskRowComplete]}
                activeOpacity={0.78}
                onPress={() => toggleBuyTask(index, taskIndex)}
              >
                <Ionicons
                  name={isChecked ? 'radio-button-on' : 'radio-button-off'}
                  size={17}
                  color={isChecked ? '#22C55E' : '#94A3B8'}
                />
                <Text style={[styles.buyTaskText, isChecked && styles.buyTaskTextComplete]}>{task}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.buyQuestionPanel}>
          {step.questions.slice(0, 2).map((question) => (
            <Text key={question} style={styles.buyQuestionText}>{question}</Text>
          ))}
        </View>
      </View>
    );
  };

  const renderBuyEmptyState = (message) => (
    <Text style={styles.buyEmptyText}>{message}</Text>
  );

  const renderBuyerMediaRow = (item) => {
    const mediaType = getDecisionListingMediaType(item);
    const caption = item?.caption || item?.Caption || item?.originalFileName || item?.OriginalFileName || mediaType;
    const icon = mediaType === 'Photo'
      ? 'image-outline'
      : mediaType === 'Video'
        ? 'videocam-outline'
        : mediaType === 'Audio'
          ? 'mic-outline'
          : 'document-text-outline';

    return (
      <TouchableOpacity key={item.id || item.ID || caption} style={styles.buyDataRow} onPress={() => openBuyerDecisionMedia(item)} activeOpacity={0.84}>
        <View style={styles.buyDataIcon}>
          <Ionicons name={icon} size={17} color={APP_PURPLE} />
        </View>
        <View style={styles.buyDataBody}>
          <Text style={styles.buyDataTitle} numberOfLines={1}>{caption}</Text>
          <Text style={styles.buyDataMeta}>{mediaType}</Text>
        </View>
        <Ionicons name="open-outline" size={16} color="#94A3B8" />
      </TouchableOpacity>
    );
  };

  const renderBuyerNoteRow = (item, index) => {
    const text = getDecisionListingNoteText(item);
    if (!text) return null;

    return (
      <View key={item.id || item.ID || `note-${index}`} style={styles.buyDataRow}>
        <View style={styles.buyDataIcon}>
          <Ionicons name="document-text-outline" size={17} color={APP_PURPLE} />
        </View>
        <View style={styles.buyDataBody}>
          <Text style={styles.buyDataTitle} numberOfLines={2}>{text}</Text>
          <Text style={styles.buyDataMeta}>{formatDate(getDecisionListingDate(item))}</Text>
        </View>
      </View>
    );
  };

  const renderBuyerTimelineRow = (item, index) => (
    <View key={item.id || item.ID || `timeline-${index}`} style={styles.buyDataRow}>
      <View style={styles.buyDataIcon}>
        <Ionicons name="calendar-outline" size={17} color={APP_PURPLE} />
      </View>
      <View style={styles.buyDataBody}>
        <Text style={styles.buyDataTitle} numberOfLines={1}>{getDecisionListingTimelineTitle(item)}</Text>
        {!!getDecisionListingTimelineNotes(item) && (
          <Text style={styles.buyDataCopy} numberOfLines={2}>{getDecisionListingTimelineNotes(item)}</Text>
        )}
        <Text style={styles.buyDataMeta}>{formatDate(getDecisionListingDate(item))}</Text>
      </View>
    </View>
  );

  const renderBuyerTaskRow = (item, index) => {
    const isComplete = String(getDecisionListingTaskStatus(item)).toLowerCase() === 'completed';
    return (
      <View key={item.id || item.ID || `task-${index}`} style={styles.buyDataRow}>
        <View style={styles.buyDataIcon}>
          <Ionicons name={isComplete ? 'checkmark-circle-outline' : 'ellipse-outline'} size={17} color={isComplete ? '#22C55E' : APP_PURPLE} />
        </View>
        <View style={styles.buyDataBody}>
          <Text style={styles.buyDataTitle} numberOfLines={1}>{getDecisionListingTaskTitle(item)}</Text>
          <Text style={styles.buyDataMeta}>{getDecisionListingTaskStatus(item)}</Text>
        </View>
      </View>
    );
  };

  const generateBuyerAssistantStrategy = async () => {
    if (buyerAssistantLoading) return;

    setBuyerAssistantLoading(true);
    setBuyerAssistantError('');
    setBuyerAssistantSuccess('');
    try {
      const assistant = await askBuyerWorkspaceAssistant({
        mode: buyerAssistantMode,
        scenario: buyerAssistantInput,
        buyerWorkspaceItemId: buyerWorkspaceContext?.buyerWorkspaceItemId,
        propertyDeckId: selectedDeckId,
        decisionBoardId: buyerContextBoard?.id,
        decisionBoardListingId: buyerContextDecisionListing?.id,
        listingId: getListingId(buyerFocusListing),
      });
      setBuyerAssistantResult(assistant);
      setBuyerAssistantInput('');
      setBuyerAssistantSuccess('Strategy generated. Review the updated recommendation, options and draft below.');
      requestAnimationFrame(() => {
        buyScrollRef.current?.scrollTo({
          y: Math.max(0, buyerAssistantSectionYRef.current - 12),
          animated: true,
        });
      });
      if (buyerAssistantSuccessTimerRef.current) {
        clearTimeout(buyerAssistantSuccessTimerRef.current);
      }
      buyerAssistantSuccessTimerRef.current = setTimeout(() => {
        setBuyerAssistantSuccess('');
      }, 6500);
    } catch (error) {
      setBuyerAssistantError(error?.response?.data?.error || error?.message || 'Could not reach the AI assistant. Showing the local playbook.');
      setBuyerAssistantSuccess('');
      setBuyerAssistantResult(null);
    } finally {
      setBuyerAssistantLoading(false);
    }
  };

  const renderBuyerAssistantWorkspace = () => {
    const modeConfig = BUY_ASSISTANT_MODES.find((item) => item.key === buyerAssistantMode) || BUY_ASSISTANT_MODES[0];
    const playbook = buyerAssistantResult || BUY_ASSISTANT_PLAYBOOK[buyerAssistantMode] || BUY_ASSISTANT_PLAYBOOK.offer;
    const listingTitle = buyerFocusListing?.Title || buyerFocusListing?.Address || buyerFocusListing?.title || 'top shortlisted property';
    const listingPrice = formatPrice(buyerFocusListing?.Price || buyerFocusListing?.price);
    const yourFitRank = getRankNumber(buyerFocusListing, 'yourFit');
    const overallRank = getRankNumber(buyerFocusListing, 'overall');
    const hasRank = Number.isFinite(yourFitRank) || Number.isFinite(overallRank);
    const scenarioText = buyerAssistantInput.trim();
    const hasGeneratedStrategy = Boolean(buyerAssistantResult);
    const highlightGeneratedSections = Boolean(buyerAssistantSuccess && hasGeneratedStrategy);

    return (
      <View
        style={styles.buyAssistantSection}
        onLayout={(event) => {
          buyerAssistantSectionYRef.current = event.nativeEvent.layout.y;
        }}
      >
        <View style={styles.buyAssistantHeader}>
          <View style={styles.buyAssistantIcon}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.buyAssistantHeaderText}>
            <Text style={styles.buySectionEyebrow}>AI buyer workspace</Text>
            <Text style={styles.buySectionTitle}>Offer & negotiation assistant</Text>
            <Text style={styles.buyAssistantCopy}>
              Shape buyer-side strategy for offers, counters, agent replies, survey issues and final decisions.
            </Text>
          </View>
        </View>

        <View style={styles.buyModeGrid}>
          {BUY_ASSISTANT_MODES.map((item) => {
            const isSelected = item.key === buyerAssistantMode;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.buyModeChip, isSelected && styles.buyModeChipActive]}
                onPress={() => setBuyerAssistantMode(item.key)}
                activeOpacity={0.85}
              >
                <Ionicons name={item.icon} size={14} color={isSelected ? '#FFFFFF' : APP_PURPLE} />
                <Text style={[styles.buyModeText, isSelected && styles.buyModeTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.buyScenarioCard}>
          <Text style={styles.buyScenarioLabel}>What happened?</Text>
          <TextInput
            value={buyerAssistantInput}
            onChangeText={(value) => {
              setBuyerAssistantInput(value);
              if (buyerAssistantSuccess) setBuyerAssistantSuccess('');
            }}
            placeholder={modeConfig.placeholder}
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.buyScenarioInput}
          />
          <TouchableOpacity
            style={[styles.buyGenerateButton, buyerAssistantLoading && styles.buyGenerateButtonDisabled]}
            onPress={generateBuyerAssistantStrategy}
            disabled={buyerAssistantLoading}
            activeOpacity={0.86}
          >
            {buyerAssistantLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.buyGenerateButtonText}>
              {buyerAssistantLoading ? 'Thinking' : 'Generate strategy'}
            </Text>
          </TouchableOpacity>
        </View>

        {!!buyerAssistantError && (
          <View style={styles.buyAssistantError}>
            <Ionicons name="information-circle-outline" size={16} color="#B45309" />
            <Text style={styles.buyAssistantErrorText}>{buyerAssistantError}</Text>
          </View>
        )}

        {!!buyerAssistantSuccess && (
          <View style={styles.buyAssistantSuccess}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#15803D" />
            <Text style={styles.buyAssistantSuccessText}>{buyerAssistantSuccess}</Text>
          </View>
        )}

        <View style={styles.buyContextStrip}>
          <Text style={styles.buyContextText} numberOfLines={2}>
            Context: {listingTitle}{listingPrice ? ` / ${listingPrice}` : ''}{hasRank ? ` / ${Number.isFinite(yourFitRank) ? `Your fit #${yourFitRank}` : `Deck #${overallRank}`}` : ''}
          </Text>
        </View>

        <View style={[styles.buyStrategyCard, highlightGeneratedSections && styles.buyGeneratedHighlight]}>
          <Text style={styles.buyStrategyLabel}>{playbook.title}</Text>
          <Text style={styles.buyStrategyRecommendation}>
            {(scenarioText || hasGeneratedStrategy) ? playbook.recommendation : `${playbook.recommendation} Add the latest agent message, offer idea or survey concern above to make this workspace specific.`}
          </Text>
        </View>

        <View style={styles.buyOptionGrid}>
          {playbook.options.map((option) => (
            <View key={option.label} style={[styles.buyOptionCard, highlightGeneratedSections && styles.buyGeneratedHighlight]}>
              <Text style={styles.buyOptionLabel}>{option.label}</Text>
              <Text style={styles.buyOptionAction}>{option.action}</Text>
              <Text style={styles.buyOptionReasoning}>{option.reasoning}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.buyDraftCard, highlightGeneratedSections && styles.buyGeneratedHighlight]}>
          <View style={styles.buyDraftHeader}>
            <Ionicons name="mail-outline" size={17} color={APP_PURPLE} />
            <Text style={styles.buyDraftTitle}>Agent message draft</Text>
          </View>
          <Text style={styles.buyDraftText}>{playbook.draft}</Text>
        </View>

        <View style={styles.buyInsightGrid}>
          <View style={[styles.buyInsightCard, highlightGeneratedSections && styles.buyGeneratedHighlight]}>
            <Text style={styles.buyInsightTitle}>Risks</Text>
            {playbook.risks.map((risk) => (
              <Text key={risk} style={styles.buyInsightText}>{risk}</Text>
            ))}
          </View>
          <View style={[styles.buyInsightCard, highlightGeneratedSections && styles.buyGeneratedHighlight]}>
            <Text style={styles.buyInsightTitle}>Next questions</Text>
            {playbook.questions.map((question) => (
              <Text key={question} style={styles.buyInsightText}>{question}</Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderBuyScreen = () => (
    <>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={goBackFromBuy}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.detailHeaderText}>
          <Text style={styles.title} numberOfLines={1}>Buy</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Move from shortlisted property to purchased property with a guided plan.
          </Text>
        </View>
      </View>

      {renderFlowSteps()}

      <ScrollView ref={buyScrollRef} contentContainerStyle={styles.buyScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.buyHero}>
          <View style={styles.buyHeroIcon}>
            <Ionicons name="home" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.buyHeroBody}>
            <Text style={styles.buyHeroTitle}>Buying guide</Text>
            <Text style={styles.buyHeroCopy}>
              Track the next actions, risks, documents, and evidence already gathered during Decision.
            </Text>
          </View>
        </View>

        {buyerWorkspaceContext ? (
          <View style={styles.buySourceCard}>
            <View style={styles.buySourceIcon}>
              <Ionicons name="flag-outline" size={18} color={APP_PURPLE} />
            </View>
            <View style={styles.buySourceBody}>
              <Text style={styles.buySourceEyebrow}>Moved from Decision Board</Text>
              <Text style={styles.buySourceTitle} numberOfLines={2}>
                {buyerFocusListing?.Title || buyerFocusListing?.Address || buyerFocusListing?.title || 'Decision property'}
              </Text>
              <Text style={styles.buySourceMeta} numberOfLines={1}>
                {buyerContextTitle}{buyerContextStatus ? ` / ${buyerContextStatus}` : ''}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.buyProgressCard}>
          <View style={styles.buyProgressHeader}>
            <View>
              <Text style={styles.buySectionEyebrow}>Progress tracker</Text>
              <Text style={styles.buySectionTitle}>Next: {activeBuyStep.title}</Text>
            </View>
            <Text style={styles.buyProgressValue}>{buyProgress}%</Text>
          </View>
          <View style={styles.buyProgressTrack}>
            <View style={[styles.buyProgressFill, { width: `${buyProgress}%` }]} />
          </View>
          <Text style={styles.buyProgressCopy}>
            {completedBuySteps} of {BUY_CHECKLIST.length} stages complete. Keep the buyer focused on the next practical action.
          </Text>
        </View>

        <View style={styles.buySection}>
          <Text style={styles.buySectionEyebrow}>Interactive checklist</Text>
          <Text style={styles.buySectionTitle}>10-step buying journey</Text>
          {BUY_CHECKLIST.map(renderBuyChecklistItem)}
        </View>

        {renderBuyerAssistantWorkspace()}

        <View style={styles.buySection}>
          <Text style={styles.buySectionEyebrow}>Key considerations</Text>
          <Text style={styles.buySectionTitle}>What to keep checking</Text>
          <View style={styles.buyConsiderationGrid}>
            {BUY_CONSIDERATIONS.map((group) => (
              <View key={group.title} style={styles.buyConsiderationCard}>
                <Text style={styles.buyConsiderationTitle}>{group.title}</Text>
                {group.items.slice(0, 5).map((item) => (
                  <Text key={item} style={styles.buyConsiderationItem}>{item}</Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.buySection}>
          <Text style={styles.buySectionEyebrow}>Decision Board integration</Text>
          <Text style={styles.buySectionTitle}>Evidence to carry forward</Text>
          <View style={styles.buyEvidenceGrid}>
            {buyerEvidenceItems.map(([item, count]) => (
              <View key={item} style={[styles.buyEvidencePill, count > 0 && styles.buyEvidencePillActive]}>
                <Ionicons name={count > 0 ? 'checkmark-circle-outline' : 'ellipse-outline'} size={14} color={count > 0 ? '#22C55E' : '#94A3B8'} />
                <Text style={styles.buyEvidenceText}>{item}</Text>
                <Text style={styles.buyEvidenceCount}>{count}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.buyDecisionButton} onPress={openDecisionBoardsForDeck}>
            <Ionicons name="git-branch-outline" size={17} color="#FFFFFF" />
            <Text style={styles.buyDecisionButtonText}>Open Decision Board</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buySection}>
          <Text style={styles.buySectionEyebrow}>Documents, notes & timeline</Text>
          <View style={styles.buyDataPanel}>
            <View style={styles.buyDataBlock}>
              <Text style={styles.buyDataBlockTitle}>Media & documents</Text>
              {buyerDecisionMedia.length ? buyerDecisionMedia.slice(0, 8).map(renderBuyerMediaRow) : renderBuyEmptyState('No media or documents have been added from the Decision Board yet.')}
            </View>

            <View style={styles.buyDataBlock}>
              <Text style={styles.buyDataBlockTitle}>Notes</Text>
              {buyerDecisionNotes.length ? buyerDecisionNotes.slice(0, 6).map(renderBuyerNoteRow) : renderBuyEmptyState('No Decision Board notes yet.')}
            </View>

            <View style={styles.buyDataBlock}>
              <Text style={styles.buyDataBlockTitle}>Timeline</Text>
              {buyerDecisionTimeline.length ? buyerDecisionTimeline.slice(0, 6).map(renderBuyerTimelineRow) : renderBuyEmptyState('No Decision Board timeline events yet.')}
            </View>

            <View style={styles.buyDataBlock}>
              <Text style={styles.buyDataBlockTitle}>Tasks</Text>
              {buyerDecisionTasks.length ? buyerDecisionTasks.slice(0, 6).map(renderBuyerTaskRow) : renderBuyEmptyState('No Decision Board tasks yet.')}
            </View>

            <View style={styles.buyDataBlock}>
              <Text style={styles.buyDataBlockTitle}>Linked contacts</Text>
              {[...buyerDecisionAgents.map((item) => ['agent', item]), ...buyerDecisionBrokers.map((item) => ['broker', item])].length ? (
                [...buyerDecisionAgents.map((item) => ['agent', item]), ...buyerDecisionBrokers.map((item) => ['broker', item])].slice(0, 6).map(([type, item], index) => (
                  <View key={`${type}-${item.id || item.ID || index}`} style={styles.buyDataRow}>
                    <View style={styles.buyDataIcon}>
                      <Ionicons name={type === 'broker' ? 'business-outline' : 'person-outline'} size={17} color={APP_PURPLE} />
                    </View>
                    <View style={styles.buyDataBody}>
                      <Text style={styles.buyDataTitle} numberOfLines={1}>{getParticipantName(item, type)}</Text>
                      <Text style={styles.buyDataMeta}>{type === 'broker' ? 'Broker' : 'Agent'}</Text>
                    </View>
                  </View>
                ))
              ) : renderBuyEmptyState('No agents or brokers are linked to this listing yet.')}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );

  const renderPreviewModal = () => {
    if (!previewListing) return null;

    const imageUrls = normalizeImageUrls(previewListing);

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setPreviewListing(null)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewHeaderTitle}>Listing Preview</Text>
              <TouchableOpacity style={styles.previewCloseButton} onPress={() => setPreviewListing(null)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {imageUrls[0] ? (
                <Image source={{ uri: imageUrls[0] }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, styles.placeholderImage]}>
                  <Ionicons name="home-outline" size={44} color="#C7CDD8" />
                </View>
              )}

              <View style={styles.previewBody}>
                <Text style={styles.previewPrice}>{formatPrice(previewListing.Price)}</Text>
                <Text style={styles.previewTitle}>
                  {previewListing.Title || previewListing.Address || 'Property match'}
                </Text>
                <Text style={styles.previewMeta}>
                  {[previewListing.Beds && `${previewListing.Beds} beds`, previewListing.Baths && `${previewListing.Baths} baths`, previewListing.PropertyType]
                    .filter(Boolean)
                    .join(' / ')}
                </Text>
                {!!previewListing.Description && (
                  <Text style={styles.previewDescription}>{previewListing.Description}</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[styles.previewActionButton, styles.previewSkipButton]}
                onPress={() => handlePreviewDecision('left')}
              >
                <Ionicons name="close" size={20} color="#475569" />
                <Text style={styles.previewSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewActionButton, styles.previewDetailsButton]}
                onPress={() => openFullListing(previewListing)}
              >
                <Ionicons name="open-outline" size={20} color={APP_PURPLE} />
                <Text style={styles.previewDetailsText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewActionButton, styles.previewShortlistButton]}
                onPress={() => handlePreviewDecision('right')}
              >
                <Ionicons name="albums" size={20} color="#FFFFFF" />
                <Text style={styles.previewShortlistText}>Shortlist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderDeckFilterModal = () => (
    <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
      <View style={styles.previewOverlay}>
        <View style={styles.filterModalCard}>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.previewHeaderTitle}>Property Deck Filters</Text>
              <Text style={styles.filterResultText}>
                {filteredDeckListings.length} of {deckListings.length} listings
              </Text>
            </View>
            <TouchableOpacity style={styles.previewCloseButton} onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.filterModalBody} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.preferencesButton}
              onPress={() => {
                setFilterModalVisible(false);
                navigation.navigate('BuyerPreferences', {
                  scope: 'deck',
                  propertyDeckId: selectedDeckId,
                  deckName: selectedDeck?.name || 'Property Deck',
                });
              }}
            >
              <View style={styles.preferencesButtonIcon}>
                <Ionicons name="options-outline" size={18} color={APP_PURPLE} />
              </View>
              <View style={styles.preferencesButtonTextWrap}>
                <Text style={styles.preferencesButtonTitle}>Buyer preferences</Text>
                <Text style={styles.preferencesButtonCopy}>
                  Review personal fit signals before ranking this deck.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>

            {renderFilterSection(
              'Property type',
              renderChoiceChips(PROPERTY_TYPE_OPTIONS, deckFilters.propertyType, (key) => setDeckFilterValue('propertyType', key))
            )}

            {renderFilterSection(
              'Include, exclude & show only',
              SPECIAL_FILTERS.map((item) => (
                <View key={item.key} style={styles.triFilterRow}>
                  <Text style={styles.triFilterTitle}>{item.label}</Text>
                  <View style={styles.triFilterOptions}>
                    {TRI_STATE_OPTIONS.map((mode) => {
                      const isSelected = deckFilters.special?.[item.key] === mode;
                      const label = mode === 'only' ? 'Show only' : mode.charAt(0).toUpperCase() + mode.slice(1);
                      return (
                        <TouchableOpacity
                          key={mode}
                          style={[styles.triFilterButton, isSelected && styles.triFilterButtonSelected]}
                          onPress={() => setSpecialFilterMode(item.key, mode)}
                        >
                          <Text style={[styles.triFilterButtonText, isSelected && styles.triFilterButtonTextSelected]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))
            )}

            {renderFilterSection(
              'Must-haves',
              renderToggleChips(MUST_HAVE_FILTERS, deckFilters.mustHaves, (key) => toggleArrayFilter('mustHaves', key))
            )}

            {renderFilterSection(
              'Ownership',
              renderChoiceChips(OWNERSHIP_OPTIONS, deckFilters.ownership, (key) => setDeckFilterValue('ownership', key))
            )}

            {renderFilterSection(
              'Property status',
              renderToggleChips(STATUS_FILTERS, deckFilters.statuses, (key) => toggleArrayFilter('statuses', key))
            )}

            {renderFilterSection(
              'Property features',
              renderChoiceChips(FEATURE_OPTIONS, deckFilters.feature, (key) => setDeckFilterValue('feature', key))
            )}

            {SHOW_DATE_ADDED_FILTER && renderFilterSection(
              'Date added',
              renderChoiceChips(ADDED_OPTIONS, deckFilters.added, (key) => setDeckFilterValue('added', key))
            )}
          </ScrollView>

          <View style={styles.filterFooter}>
            <TouchableOpacity style={styles.filterResetButton} onPress={resetDeckFilters}>
              <Text style={styles.filterResetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.filterApplyButtonText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {mode === 'shortlist'
        ? renderShortlistScreen()
        : mode === 'buy'
          ? renderBuyScreen()
        : mode === 'detail'
          ? renderDetailScreen()
          : renderListScreen()}
      {renderPreviewModal()}
      {renderDeckFilterModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F7F8FB',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
    width: 40,
  },
  detailHeaderText: {
    flex: 1,
  },
  headerFilterButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    flexDirection: 'row',
    marginLeft: 8,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  headerFilterButtonText: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 5,
  },
  title: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 3,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  disabledCreateButton: {
    backgroundColor: '#E5E7EB',
  },
  deckList: {
    padding: 18,
    paddingBottom: 32,
  },
  deckListItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 14,
  },
  deckListIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  deckListContent: {
    flex: 1,
  },
  deckListActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  deckListTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  deckListMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  deckNameInput: {
    borderBottomColor: APP_PURPLE,
    borderBottomWidth: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 2,
  },
  iconButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    marginLeft: 8,
    width: 42,
  },
  deletedSection: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 18,
  },
  deletedSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  deletedSectionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  deletedSectionMeta: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  deletedDeckListItem: {
    borderColor: '#FEE2E2',
    borderWidth: 1,
  },
  deletedDeckIcon: {
    backgroundColor: '#FEF2F2',
  },
  deletedDeckActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  restoreButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 32,
    paddingHorizontal: 9,
  },
  restoreButtonText: {
    color: APP_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
  },
  destroyButton: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 32,
    paddingHorizontal: 9,
  },
  destroyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
  },
  flowStepsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  flowStepItem: {
    flex: 1,
  },
  flowStepTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  flowStepDot: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  flowStepDotActive: {
    backgroundColor: APP_PURPLE,
    borderColor: APP_PURPLE,
  },
  flowStepDotComplete: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  flowStepNumber: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
  },
  flowStepNumberActive: {
    color: '#FFFFFF',
  },
  flowStepLine: {
    backgroundColor: '#E5E7EB',
    flex: 1,
    height: 3,
    marginHorizontal: 6,
  },
  flowStepLineActive: {
    backgroundColor: APP_PURPLE,
  },
  flowStepLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
  },
  flowStepLabelActive: {
    color: '#111827',
  },
  deckFlowContent: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    paddingBottom: 92,
  },
  flowStepHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  flowCounter: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  flowNextButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 999,
    bottom: 18,
    elevation: 4,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 18,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  disabledFlowNextButton: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  flowNextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 8,
  },
  disabledFlowNextButtonText: {
    color: '#94A3B8',
  },
  shortlistScreenList: {
    padding: 16,
    paddingBottom: 96,
  },
  shortlistSortBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shortlistSortLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  shortlistSortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  shortlistBoardButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 34,
    paddingHorizontal: 12,
  },
  shortlistBoardButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  shortlistSortOption: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shortlistSortOptionActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  shortlistSortOptionDisabled: {
    opacity: 0.45,
  },
  shortlistSortOptionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
  },
  shortlistSortOptionTextActive: {
    color: APP_PURPLE,
  },
  shortlistSortOptionTextDisabled: {
    color: '#94A3B8',
  },
  shortlistUndoBar: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 10,
    borderWidth: 1,
    elevation: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    right: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    zIndex: 20,
  },
  shortlistUndoTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  shortlistUndoTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  shortlistUndoText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  shortlistUndoButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 34,
    paddingHorizontal: 10,
  },
  shortlistUndoButtonText: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 5,
  },
  buyScrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  buyHero: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 14,
  },
  buyHeroIcon: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    marginRight: 12,
    width: 46,
  },
  buyHeroBody: {
    flex: 1,
  },
  buyHeroTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
  },
  buyHeroCopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  buySourceCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D2FE',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
  },
  buySourceIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    marginRight: 10,
    width: 38,
  },
  buySourceBody: {
    flex: 1,
  },
  buySourceEyebrow: {
    color: APP_PURPLE,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  buySourceTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: 3,
  },
  buySourceMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  buyProgressCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  buyProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buyProgressValue: {
    color: APP_PURPLE,
    fontSize: 22,
    fontWeight: '900',
  },
  buyProgressTrack: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    height: 8,
    marginTop: 12,
    overflow: 'hidden',
  },
  buyProgressFill: {
    backgroundColor: APP_PURPLE,
    borderRadius: 999,
    height: '100%',
  },
  buyProgressCopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  buySection: {
    marginTop: 14,
  },
  buySectionEyebrow: {
    color: APP_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  buySectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
    marginBottom: 10,
  },
  buyChecklistCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  buyChecklistCardComplete: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BBF7D0',
    opacity: 0.88,
  },
  buyChecklistHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  buyStepNumber: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    marginRight: 10,
    width: 34,
  },
  buyStepNumberComplete: {
    backgroundColor: '#22C55E',
  },
  buyStepNumberText: {
    color: APP_PURPLE,
    fontSize: 13,
    fontWeight: '900',
  },
  buyChecklistTitleWrap: {
    flex: 1,
  },
  buyChecklistTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  buyChecklistTitleComplete: {
    color: '#64748B',
  },
  buyStatusText: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  buyStatusComplete: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  buyStatusInProgress: {
    backgroundColor: '#EEF2FF',
    color: APP_PURPLE,
  },
  buyStatusNotStarted: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  buyTaskList: {
    gap: 7,
    marginTop: 10,
  },
  buyTaskRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 38,
    paddingHorizontal: 10,
  },
  buyTaskRowComplete: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  buyTaskText: {
    color: '#475569',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 7,
  },
  buyTaskTextComplete: {
    color: '#15803D',
    textDecorationLine: 'line-through',
  },
  buyQuestionPanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginTop: 10,
    padding: 10,
  },
  buyQuestionText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginBottom: 4,
  },
  buyAssistantSection: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  buyAssistantHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  buyAssistantIcon: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    marginRight: 10,
    width: 40,
  },
  buyAssistantHeaderText: {
    flex: 1,
  },
  buyAssistantCopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: -4,
  },
  buyModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  buyModeChip: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 34,
    paddingHorizontal: 10,
  },
  buyModeChipActive: {
    backgroundColor: APP_PURPLE,
    borderColor: APP_PURPLE,
  },
  buyModeText: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  buyModeTextActive: {
    color: '#FFFFFF',
  },
  buyScenarioCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  buyScenarioLabel: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  buyScenarioInput: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    minHeight: 76,
    padding: 0,
    textAlignVertical: 'top',
  },
  buyGenerateButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flexDirection: 'row',
    marginTop: 10,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  buyGenerateButtonDisabled: {
    opacity: 0.72,
  },
  buyGenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },
  buyAssistantError: {
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    padding: 10,
  },
  buyAssistantErrorText: {
    color: '#92400E',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginLeft: 7,
  },
  buyAssistantSuccess: {
    alignItems: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    padding: 10,
  },
  buyAssistantSuccessText: {
    color: '#166534',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginLeft: 7,
  },
  buyContextStrip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buyContextText: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  buyStrategyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderColor: 'transparent',
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  buyGeneratedHighlight: {
    borderColor: '#22C55E',
  },
  buyStrategyLabel: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  buyStrategyRecommendation: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  buyOptionGrid: {
    gap: 8,
    marginTop: 10,
  },
  buyOptionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  buyOptionLabel: {
    color: APP_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  buyOptionAction: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: 4,
  },
  buyOptionReasoning: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  buyDraftCard: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FDE68A',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  buyDraftHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 6,
  },
  buyDraftTitle: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  buyDraftText: {
    color: '#3F3F46',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  buyInsightGrid: {
    gap: 8,
    marginTop: 10,
  },
  buyInsightCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  buyInsightTitle: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 5,
  },
  buyInsightText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 3,
  },
  buyConsiderationGrid: {
    gap: 10,
  },
  buyConsiderationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  buyConsiderationTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  buyConsiderationItem: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  buyEvidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buyEvidencePill: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  buyEvidencePillActive: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  buyEvidenceText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  buyEvidenceCount: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },
  buyDecisionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flexDirection: 'row',
    marginTop: 12,
    minHeight: 40,
    paddingHorizontal: 13,
  },
  buyDecisionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  buyToolRow: {
    gap: 10,
  },
  buyToolCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  buyToolTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  buyToolCopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  buyDataPanel: {
    gap: 10,
  },
  buyDataBlock: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  buyDataBlockTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  buyDataRow: {
    alignItems: 'center',
    borderTopColor: '#F1F5F9',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
  },
  buyDataIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  buyDataBody: {
    flex: 1,
    marginLeft: 9,
  },
  buyDataTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  buyDataCopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  buyDataMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  buyEmptyText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  columnsContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 6,
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 6,
  },
  columnTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  columnHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  boardButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 32,
    paddingHorizontal: 10,
  },
  disabledBoardButton: {
    backgroundColor: '#E5E7EB',
  },
  boardButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 5,
  },
  disabledBoardButtonText: {
    color: '#94A3B8',
  },
  deckCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  deckImage: {
    backgroundColor: '#EEF2F7',
    height: 220,
    width: '100%',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckContent: {
    padding: 12,
  },
  deckPrice: {
    color: APP_PURPLE,
    fontSize: 17,
    fontWeight: '800',
  },
  deckTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 5,
  },
  deckMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  distanceText: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 7,
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  skipButton: {
    backgroundColor: '#E5E7EB',
  },
  shortlistButton: {
    backgroundColor: APP_PURPLE,
  },
  shortlistItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 112,
    overflow: 'hidden',
  },
  shortlistItemPendingRemoval: {
    backgroundColor: '#F8FAFC',
    opacity: 0.78,
  },
  shortlistRank: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    width: 32,
  },
  shortlistImage: {
    backgroundColor: '#EEF2F7',
    height: 92,
    width: 70,
  },
  shortlistContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  shortlistPrice: {
    color: APP_PURPLE,
    fontSize: 13,
    fontWeight: '800',
  },
  shortlistTitle: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
  },
  shortlistScoreRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  compactScorePill: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    flexDirection: 'row',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  compactUserScorePill: {
    backgroundColor: '#EEF2FF',
  },
  compactScoreLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    marginRight: 4,
    textTransform: 'uppercase',
  },
  compactUserScoreLabel: {
    color: APP_PURPLE,
  },
  compactScoreValue: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
  },
  compactUserScoreValue: {
    color: APP_PURPLE,
  },
  rankingMetaText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  shortlistDecisionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    flexDirection: 'row',
    marginTop: 8,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  shortlistDecisionButtonText: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  removeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 34,
  },
  undoRemoveButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    width: 58,
  },
  undoRemoveButtonText: {
    color: APP_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 3,
  },
  shortlistActionColumn: {
    alignItems: 'center',
    borderLeftColor: '#E5E7EB',
    borderLeftWidth: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 70,
  },
  decisionButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    marginRight: 4,
    paddingHorizontal: 6,
    width: 70,
  },
  decisionButtonText: {
    color: APP_PURPLE,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
  disabledDecisionButton: {
    backgroundColor: '#F1F5F9',
  },
  disabledDecisionButtonText: {
    color: '#94A3B8',
  },
  boardIntro: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  boardIntroIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  boardIntroText: {
    flex: 1,
  },
  boardIntroTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  boardIntroCopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  boardList: {
    padding: 14,
    paddingBottom: 32,
  },
  compareRow: {
    gap: 12,
    padding: 14,
  },
  compareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    width: 270,
  },
  compareLabel: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingTop: 10,
    textTransform: 'uppercase',
  },
  compareImage: {
    backgroundColor: '#EEF2F7',
    height: 120,
    marginTop: 8,
    width: '100%',
  },
  compareBody: {
    padding: 12,
  },
  compareScoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  compareScore: {
    backgroundColor: '#EEF2FF',
    borderRadius: 7,
    color: APP_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  compareSubhead: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  compareNote: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  compareEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    padding: 18,
  },
  compareDecisionButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 42,
  },
  compareDecisionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  boardCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
  },
  boardRank: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    width: 38,
  },
  boardImage: {
    backgroundColor: '#EEF2F7',
    height: 92,
    width: 86,
  },
  boardContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  boardPrice: {
    color: APP_PURPLE,
    fontSize: 14,
    fontWeight: '900',
  },
  boardTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 4,
  },
  boardMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  ratingStack: {
    paddingRight: 10,
    width: 84,
  },
  ratingPill: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginVertical: 3,
    paddingVertical: 6,
  },
  userRatingPill: {
    backgroundColor: '#EEF2FF',
  },
  ratingLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  userRatingLabel: {
    color: APP_PURPLE,
  },
  ratingValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
  },
  userRatingValue: {
    color: APP_PURPLE,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 56,
  },
  detailEmptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 280,
    paddingHorizontal: 20,
  },
  shortlistEmpty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 30,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  previewOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  filterModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  previewHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewHeaderTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  filterResultText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  previewCloseButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  previewImage: {
    backgroundColor: '#EEF2F7',
    height: 260,
    width: '100%',
  },
  previewBody: {
    padding: 16,
  },
  previewPrice: {
    color: APP_PURPLE,
    fontSize: 22,
    fontWeight: '800',
  },
  previewTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 6,
  },
  previewMeta: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  previewDescription: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
  },
  previewActions: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  previewActionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 46,
  },
  previewSkipButton: {
    backgroundColor: '#E5E7EB',
  },
  previewDetailsButton: {
    backgroundColor: '#EEF2FF',
  },
  previewShortlistButton: {
    backgroundColor: APP_PURPLE,
  },
  previewSkipText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  previewDetailsText: {
    color: APP_PURPLE,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  previewShortlistText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  filterModalBody: {
    padding: 16,
    paddingBottom: 24,
  },
  preferencesButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 12,
  },
  preferencesButtonCopy: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  preferencesButtonIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  preferencesButtonTextWrap: {
    flex: 1,
  },
  preferencesButtonTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  filterSection: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  filterSectionTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  filterChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  filterChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: APP_PURPLE,
  },
  filterChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextSelected: {
    color: APP_PURPLE,
  },
  triFilterRow: {
    marginBottom: 14,
  },
  triFilterTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  triFilterOptions: {
    flexDirection: 'row',
    gap: 7,
  },
  triFilterButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
  },
  triFilterButtonSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: APP_PURPLE,
  },
  triFilterButtonText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
  },
  triFilterButtonTextSelected: {
    color: APP_PURPLE,
  },
  filterFooter: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  filterResetButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
  },
  filterResetButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '900',
  },
  filterApplyButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flex: 1.4,
    minHeight: 46,
    justifyContent: 'center',
  },
  filterApplyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
