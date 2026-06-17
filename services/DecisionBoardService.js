import { api } from './api';

export const BOARD_TYPES = ['Buyer', 'Investor', 'Developer'];
export const BOARD_STATUSES = ['Active', 'Tentative', 'Closed'];
export const LISTING_STATUSES = ['Active', 'Tentative', 'Closed'];
export const TRAFFIC_LIGHT_STATUSES = ['Green', 'Orange', 'Red'];
export const VIEWING_STATUSES = ['Arranged', 'Completed', 'Cancelled', 'Rescheduled'];
export const USER_VERDICTS = ['StrongYes', 'Maybe', 'No', 'OnHold'];
export const BROKER_STATUSES = ['Contacted', 'InProgress', 'Approved', 'Rejected', 'NotUsing'];
export const DECISION_MEDIA_TYPES = ['Photo', 'Video', 'Audio', 'Document'];

export const BOARD_LIMITS = {
  Buyer: 10,
  Investor: 20,
  Developer: 20,
};

export const getDecisionBoardLimit = (boardType) => BOARD_LIMITS[boardType] || BOARD_LIMITS.Buyer;

const getValue = (source, keys, fallback = null) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) return value;
  }

  return fallback;
};

const stringifyId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
};

const compactPayload = (payload = {}) => (
  Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {})
);

const requireId = (value, label) => {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${label} is required`);
  }
};

const normalizeListing = (listing) => {
  if (!listing || typeof listing !== 'object') return listing || null;

  const imageUrls = getValue(listing, [
    'ImageUrls',
    'imageUrls',
    'image_urls',
    'Images',
    'images',
    'ImageUrl',
    'imageUrl',
    'image_url',
    'PrimaryImageUrl',
    'primaryImageUrl',
    'primary_image_url',
    'MainImageUrl',
    'mainImageUrl',
    'main_image_url',
    'PhotoUrl',
    'photoUrl',
    'photo_url',
    'ThumbnailUrl',
    'thumbnailUrl',
    'thumbnail_url',
  ], []);

  return {
    ...listing,
    ID: stringifyId(getValue(listing, ['ID', 'id', 'ListingID', 'listingId'])),
    Title: getValue(listing, ['Title', 'title', 'Address', 'address'], ''),
    Price: getValue(listing, ['Price', 'price'], null),
    ImageUrls: imageUrls,
  };
};

export const normalizeDecisionBoardListing = (item) => {
  if (!item || typeof item !== 'object') return null;

  const hasNestedListing = Boolean(item.listing || item.Listing);
  const listing = normalizeListing(getValue(item, ['listing', 'Listing'], item));
  const trafficLightStatus = getValue(item, ['trafficLightStatus', 'TrafficLightStatus'], null);
  const listingStatus = getValue(item, ['listingStatus', 'ListingStatus'], 'Active');
  const listingId = stringifyId(getValue(item, ['listingId', 'ListingID'], listing?.ID));
  const rawAgents = getValue(item, ['agents', 'Agents', 'listingAgents', 'ListingAgents'], []);
  const rawBrokers = getValue(item, ['brokers', 'Brokers', 'listingBrokers', 'ListingBrokers'], []);
  const rawTimeline = getValue(item, ['timeline', 'Timeline', 'events', 'Events'], []);
  const rawTasks = getValue(item, ['tasks', 'Tasks'], []);
  const rawNotes = getValue(item, ['listingNotes', 'ListingNotes', 'noteEntries', 'NoteEntries'], []);
  const rawMedia = getValue(item, ['media', 'Media'], []);

  return {
    ...item,
    id: stringifyId(getValue(item, ['id', 'ID', 'decisionBoardListingId', 'DecisionBoardListingID'])),
    decisionBoardId: stringifyId(getValue(item, ['decisionBoardId', 'DecisionBoardID'])),
    listingId,
    listingStatus,
    trafficLightStatus: trafficLightStatus || (
      listingStatus === 'Closed' ? 'Red' : listingStatus === 'Tentative' ? 'Orange' : 'Green'
    ),
    viewingDate: getValue(item, ['viewingDate', 'ViewingDate'], null),
    viewingStatus: getValue(item, ['viewingStatus', 'ViewingStatus'], null),
    userVerdict: getValue(item, ['userVerdict', 'UserVerdict'], null),
    notes: getValue(item, ['notes', 'Notes'], null),
    createdAt: getValue(item, ['createdAt', 'CreatedAt'], null),
    updatedAt: getValue(item, ['updatedAt', 'UpdatedAt'], null),
    listing: hasNestedListing ? listing : { ...listing, ID: listingId },
    agents: Array.isArray(rawAgents) ? rawAgents.map(normalizeDecisionBoardListingAgent).filter(Boolean) : [],
    brokers: Array.isArray(rawBrokers) ? rawBrokers.map(normalizeDecisionBoardListingBroker).filter(Boolean) : [],
    timeline: Array.isArray(rawTimeline) ? rawTimeline.map(normalizeTimelineEvent).filter(Boolean) : [],
    tasks: Array.isArray(rawTasks) ? rawTasks.map(normalizeTask).filter(Boolean) : [],
    listingNotes: Array.isArray(rawNotes) ? rawNotes.map(normalizeDecisionBoardNote).filter(Boolean) : [],
    media: Array.isArray(rawMedia) ? rawMedia.map(normalizeMedia).filter(Boolean) : [],
  };
};

const normalizeTimelineEvent = (event) => {
  if (!event || typeof event !== 'object') return null;

  return {
    ...event,
    id: stringifyId(getValue(event, ['id', 'ID'])),
    decisionBoardListingId: stringifyId(getValue(event, ['decisionBoardListingId', 'DecisionBoardListingID'])),
    stageName: getValue(event, ['stageName', 'StageName'], ''),
    status: getValue(event, ['status', 'Status'], 'pending'),
    notes: getValue(event, ['notes', 'Notes'], null),
    eventDate: getValue(event, ['eventDate', 'EventDate'], null),
    createdAt: getValue(event, ['createdAt', 'CreatedAt'], null),
    updatedAt: getValue(event, ['updatedAt', 'UpdatedAt'], null),
  };
};

const normalizeTask = (task) => {
  if (!task || typeof task !== 'object') return null;

  return {
    ...task,
    id: stringifyId(getValue(task, ['id', 'ID'])),
    decisionBoardListingId: stringifyId(getValue(task, ['decisionBoardListingId', 'DecisionBoardListingID'])),
    taskName: getValue(task, ['taskName', 'TaskName'], ''),
    taskType: getValue(task, ['taskType', 'TaskType'], null),
    status: getValue(task, ['status', 'Status'], 'pending'),
    dueDate: getValue(task, ['dueDate', 'DueDate'], null),
    completedAt: getValue(task, ['completedAt', 'CompletedAt'], null),
    notes: getValue(task, ['notes', 'Notes'], null),
    createdAt: getValue(task, ['createdAt', 'CreatedAt'], null),
    updatedAt: getValue(task, ['updatedAt', 'UpdatedAt'], null),
  };
};

const normalizeDecisionBoardNote = (note) => {
  if (!note || typeof note !== 'object') return null;

  return {
    ...note,
    id: stringifyId(getValue(note, ['id', 'ID'])),
    decisionBoardListingId: stringifyId(getValue(note, ['decisionBoardListingId', 'DecisionBoardListingID'])),
    noteText: getValue(note, ['noteText', 'NoteText', 'notes', 'Notes'], ''),
    createdAt: getValue(note, ['createdAt', 'CreatedAt'], null),
    updatedAt: getValue(note, ['updatedAt', 'UpdatedAt'], null),
  };
};

const normalizeMedia = (media) => {
  if (!media || typeof media !== 'object') return null;

  return {
    ...media,
    id: stringifyId(getValue(media, ['id', 'ID'])),
    decisionBoardListingId: stringifyId(getValue(media, ['decisionBoardListingId', 'DecisionBoardListingID'])),
    mediaType: getValue(media, ['mediaType', 'MediaType'], ''),
    fileUrl: getValue(media, ['fileUrl', 'FileUrl', 'url', 'Url'], ''),
    caption: getValue(media, ['caption', 'Caption'], null),
    isPublic: Boolean(getValue(media, ['isPublic', 'IsPublic'], false)),
    createdAt: getValue(media, ['createdAt', 'CreatedAt'], null),
    updatedAt: getValue(media, ['updatedAt', 'UpdatedAt'], null),
  };
};

export const normalizeDecisionBoardAgent = (agent) => {
  if (!agent || typeof agent !== 'object') return null;

  const realEstateAgent = getValue(agent, ['realEstateAgent', 'RealEstateAgent', 'agent', 'Agent'], agent);

  return {
    ...agent,
    id: stringifyId(getValue(agent, ['id', 'ID', 'decisionBoardAgentId', 'DecisionBoardAgentID'])),
    decisionBoardAgentId: stringifyId(getValue(agent, ['decisionBoardAgentId', 'DecisionBoardAgentID', 'id', 'ID'])),
    realEstateAgentId: stringifyId(getValue(agent, ['realEstateAgentId', 'RealEstateAgentID'], getValue(realEstateAgent, ['id', 'ID']))),
    decisionBoardId: stringifyId(getValue(agent, ['decisionBoardId', 'DecisionBoardID'])),
    agentName: getValue(agent, ['agentName', 'AgentName'], getValue(realEstateAgent, ['agentName', 'AgentName', 'name', 'Name'], '')),
    companyName: getValue(agent, ['companyName', 'CompanyName'], getValue(realEstateAgent, ['companyName', 'CompanyName'], '')),
    phone: getValue(agent, ['phone', 'Phone'], getValue(realEstateAgent, ['phone', 'Phone'], '')),
    email: getValue(agent, ['email', 'Email'], getValue(realEstateAgent, ['email', 'Email'], '')),
    website: getValue(agent, ['website', 'Website'], getValue(realEstateAgent, ['website', 'Website'], '')),
    branchName: getValue(agent, ['branchName', 'BranchName'], getValue(realEstateAgent, ['branchName', 'BranchName'], '')),
    address: getValue(agent, ['address', 'Address'], getValue(realEstateAgent, ['address', 'Address'], '')),
    notes: getValue(agent, ['notes', 'Notes'], getValue(realEstateAgent, ['notes', 'Notes'], null)),
    createdAt: getValue(agent, ['createdAt', 'CreatedAt'], null),
  };
};

export const normalizeDecisionBoardBroker = (broker) => {
  if (!broker || typeof broker !== 'object') return null;

  const mortgageBroker = getValue(broker, ['broker', 'Broker', 'mortgageBroker', 'MortgageBroker'], broker);

  return {
    ...broker,
    id: stringifyId(getValue(broker, ['id', 'ID', 'decisionBoardBrokerId', 'DecisionBoardBrokerID'])),
    decisionBoardBrokerId: stringifyId(getValue(broker, ['decisionBoardBrokerId', 'DecisionBoardBrokerID', 'id', 'ID'])),
    brokerId: stringifyId(getValue(broker, ['brokerId', 'BrokerID', 'mortgageBrokerId', 'MortgageBrokerID'], getValue(mortgageBroker, ['id', 'ID']))),
    decisionBoardId: stringifyId(getValue(broker, ['decisionBoardId', 'DecisionBoardID'])),
    brokerName: getValue(broker, ['brokerName', 'BrokerName'], getValue(mortgageBroker, ['brokerName', 'BrokerName', 'name', 'Name'], '')),
    companyName: getValue(broker, ['companyName', 'CompanyName'], getValue(mortgageBroker, ['companyName', 'CompanyName'], '')),
    phone: getValue(broker, ['phone', 'Phone'], getValue(mortgageBroker, ['phone', 'Phone'], '')),
    email: getValue(broker, ['email', 'Email'], getValue(mortgageBroker, ['email', 'Email'], '')),
    website: getValue(broker, ['website', 'Website'], getValue(mortgageBroker, ['website', 'Website'], '')),
    address: getValue(broker, ['address', 'Address'], getValue(mortgageBroker, ['address', 'Address'], '')),
    status: getValue(broker, ['status', 'Status'], 'Contacted'),
    notes: getValue(broker, ['notes', 'Notes'], getValue(mortgageBroker, ['notes', 'Notes'], null)),
    createdAt: getValue(broker, ['createdAt', 'CreatedAt'], null),
  };
};

const normalizeDecisionBoardListingAgent = (agent) => {
  if (!agent || typeof agent !== 'object') return null;

  const normalized = normalizeDecisionBoardAgent(agent);
  const decisionBoardListingAgentId = stringifyId(getValue(agent, [
    'decisionBoardListingAgentId',
    'DecisionBoardListingAgentID',
    'listingAgentId',
    'ListingAgentID',
    'linkId',
    'LinkID',
    'id',
    'ID',
  ]));
  const decisionBoardAgentId = stringifyId(getValue(agent, [
    'decisionBoardAgentId',
    'DecisionBoardAgentID',
    'boardAgentId',
    'BoardAgentID',
  ]));

  return {
    ...normalized,
    id: decisionBoardListingAgentId || normalized?.id,
    decisionBoardListingAgentId,
    decisionBoardAgentId,
  };
};

const normalizeDecisionBoardListingBroker = (broker) => {
  if (!broker || typeof broker !== 'object') return null;

  const normalized = normalizeDecisionBoardBroker(broker);
  const decisionBoardListingBrokerId = stringifyId(getValue(broker, [
    'decisionBoardListingBrokerId',
    'DecisionBoardListingBrokerID',
    'listingBrokerId',
    'ListingBrokerID',
    'linkId',
    'LinkID',
    'id',
    'ID',
  ]));
  const decisionBoardBrokerId = stringifyId(getValue(broker, [
    'decisionBoardBrokerId',
    'DecisionBoardBrokerID',
    'boardBrokerId',
    'BoardBrokerID',
  ]));

  return {
    ...normalized,
    id: decisionBoardListingBrokerId || normalized?.id,
    decisionBoardListingBrokerId,
    decisionBoardBrokerId,
  };
};

export const normalizeDecisionBoard = (board) => {
  if (!board || typeof board !== 'object') return null;

  const rawListings = getValue(board, ['listings', 'Listings', 'decisionBoardListings', 'DecisionBoardListings'], []);
  const rawAgents = getValue(board, ['agents', 'Agents'], []);
  const rawBrokers = getValue(board, ['brokers', 'Brokers'], []);
  const rawTimeline = getValue(board, ['timeline', 'Timeline', 'events', 'Events'], []);
  const rawTasks = getValue(board, ['tasks', 'Tasks'], []);
  const rawMedia = getValue(board, ['media', 'Media'], []);
  const boardType = getValue(board, ['boardType', 'BoardType'], 'Buyer');
  const status = getValue(board, ['status', 'Status', 'boardStatus', 'BoardStatus'], 'Active');

  return {
    ...board,
    id: stringifyId(getValue(board, ['id', 'ID'])),
    userId: stringifyId(getValue(board, ['userId', 'UserID'])),
    boardName: getValue(board, ['boardName', 'BoardName', 'name', 'Name'], 'Decision Board'),
    boardType,
    status,
    maxProperties: Number(getValue(board, ['maxProperties', 'MaxProperties'], getDecisionBoardLimit(boardType))) || getDecisionBoardLimit(boardType),
    createdAt: getValue(board, ['createdAt', 'CreatedAt'], null),
    updatedAt: getValue(board, ['updatedAt', 'UpdatedAt'], null),
    listings: Array.isArray(rawListings) ? rawListings.map(normalizeDecisionBoardListing).filter(Boolean) : [],
    agents: Array.isArray(rawAgents) ? rawAgents.map(normalizeDecisionBoardAgent).filter(Boolean) : [],
    brokers: Array.isArray(rawBrokers) ? rawBrokers.map(normalizeDecisionBoardBroker).filter(Boolean) : [],
    timeline: Array.isArray(rawTimeline) ? rawTimeline.map(normalizeTimelineEvent).filter(Boolean) : [],
    tasks: Array.isArray(rawTasks) ? rawTasks.map(normalizeTask).filter(Boolean) : [],
    media: Array.isArray(rawMedia) ? rawMedia.map(normalizeMedia).filter(Boolean) : [],
  };
};

const extractDecisionBoard = (data) => normalizeDecisionBoard(
  data?.decisionBoard || data?.DecisionBoard || data?.board || data
);

const extractDecisionBoards = (data) => {
  const boards = data?.decisionBoards || data?.DecisionBoards || data?.items || data?.data || data;
  return Array.isArray(boards) ? boards.map(normalizeDecisionBoard).filter(Boolean) : [];
};

export const createDecisionBoard = async (payload = {}) => {
  const boardType = payload.boardType || payload.BoardType || 'Buyer';
  const { data } = await api.post('/api/decision-boards', compactPayload({
    boardName: payload.boardName || payload.BoardName || payload.name || 'Decision Board',
    boardType,
    status: payload.status || payload.Status || 'Active',
    maxProperties: payload.maxProperties || payload.MaxProperties || getDecisionBoardLimit(boardType),
  }));
  return extractDecisionBoard(data);
};

export const getDecisionBoards = async (params = {}) => {
  const { data } = await api.get('/api/decision-boards', {
    params: compactPayload(params),
  });

  return extractDecisionBoards(data);
};

export const getDecisionBoard = async (decisionBoardId) => {
  requireId(decisionBoardId, 'decisionBoardId');

  const { data } = await api.get(`/api/decision-boards/${decisionBoardId}`);
  return extractDecisionBoard(data);
};

export const updateDecisionBoard = async (decisionBoardId, payload = {}) => {
  requireId(decisionBoardId, 'decisionBoardId');

  const { data } = await api.patch(
    `/api/decision-boards/${decisionBoardId}`,
    compactPayload(payload)
  );

  return extractDecisionBoard(data);
};

export const addDecisionBoardListing = async (decisionBoardId, payload = {}) => {
  requireId(decisionBoardId, 'decisionBoardId');
  requireId(payload.listingId ?? payload.ListingID, 'listingId');

  const { data } = await api.post(
    `/api/decision-boards/${decisionBoardId}/listings`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardListing(data?.decisionBoardListing || data?.listing || data);
};

export const addListingToDecisionBoardProject = async (payload = {}) => {
  requireId(payload.listingId ?? payload.ListingID, 'listingId');

  const boards = await getDecisionBoards();
  const preferredBoard = boards.find((board) => board.status === 'Active') || boards[0];
  const decisionBoard = preferredBoard || await createDecisionBoard({
    boardName: payload.boardName || 'Property Decisions',
    boardType: payload.boardType || 'Buyer',
    status: 'Active',
  });

  await addDecisionBoardListing(decisionBoard.id, {
    listingId: payload.listingId ?? payload.ListingID,
    shortListId: payload.shortListId,
    listingStatus: payload.listingStatus || 'Active',
    trafficLightStatus: payload.trafficLightStatus || 'Green',
    userVerdict: payload.userVerdict || 'Maybe',
  });

  return getDecisionBoard(decisionBoard.id);
};

export const updateDecisionBoardListing = async (decisionBoardId, decisionBoardListingId, payload = {}) => {
  requireId(decisionBoardId, 'decisionBoardId');
  requireId(decisionBoardListingId, 'decisionBoardListingId');

  const { data } = await api.patch(
    `/api/decision-boards/${decisionBoardId}/listings/${decisionBoardListingId}`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardListing(data?.decisionBoardListing || data?.listing || data);
};

export const attachDecisionBoardListingAgent = async (decisionBoardListingId, payload = {}) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(
    payload.decisionBoardAgentId ?? payload.DecisionBoardAgentID ?? payload.realEstateAgentId ?? payload.RealEstateAgentID,
    'decisionBoardAgentId'
  );

  const { data } = await api.post(
    `/api/decision-board-listings/${decisionBoardListingId}/agents`,
    compactPayload(payload)
  );

  if (data?.listingAgent) {
    return normalizeDecisionBoardListingAgent(data.listingAgent);
  }

  return normalizeDecisionBoardListing(data?.decisionBoardListing || data?.listing || data);
};

export const detachDecisionBoardListingAgent = async (decisionBoardListingId, decisionBoardListingAgentId) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(decisionBoardListingAgentId, 'decisionBoardListingAgentId');

  const { data } = await api.delete(
    `/api/decision-board-listings/${decisionBoardListingId}/agents/${decisionBoardListingAgentId}`
  );

  return normalizeDecisionBoardListing(data?.decisionBoardListing || data?.listing || data);
};

export const attachDecisionBoardListingBroker = async (decisionBoardListingId, payload = {}) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(
    payload.decisionBoardBrokerId ?? payload.DecisionBoardBrokerID ?? payload.brokerId ?? payload.BrokerID ?? payload.mortgageBrokerId ?? payload.MortgageBrokerID,
    'decisionBoardBrokerId'
  );

  const { data } = await api.post(
    `/api/decision-board-listings/${decisionBoardListingId}/brokers`,
    compactPayload(payload)
  );

  if (data?.listingBroker) {
    return normalizeDecisionBoardListingBroker(data.listingBroker);
  }

  return normalizeDecisionBoardListing(data?.decisionBoardListing || data?.listing || data);
};

export const detachDecisionBoardListingBroker = async (decisionBoardListingId, decisionBoardListingBrokerId) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(decisionBoardListingBrokerId, 'decisionBoardListingBrokerId');

  const { data } = await api.delete(
    `/api/decision-board-listings/${decisionBoardListingId}/brokers/${decisionBoardListingBrokerId}`
  );

  return normalizeDecisionBoardListing(data?.decisionBoardListing || data?.listing || data);
};

export const addDecisionBoardAgent = async (decisionBoardId, payload = {}) => {
  requireId(decisionBoardId, 'decisionBoardId');

  const { data } = await api.post(
    `/api/decision-boards/${decisionBoardId}/agents`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardAgent(data?.agent || data?.decisionBoardAgent || data);
};

export const deleteDecisionBoardAgent = async (decisionBoardId, decisionBoardAgentId) => {
  requireId(decisionBoardId, 'decisionBoardId');
  requireId(decisionBoardAgentId, 'decisionBoardAgentId');

  const { data } = await api.delete(`/api/decision-boards/${decisionBoardId}/agents/${decisionBoardAgentId}`);
  return data || { success: true };
};

export const updateDecisionBoardAgent = async (decisionBoardId, decisionBoardAgentId, payload = {}) => {
  requireId(decisionBoardId, 'decisionBoardId');
  requireId(decisionBoardAgentId, 'decisionBoardAgentId');

  const { data } = await api.patch(
    `/api/decision-boards/${decisionBoardId}/agents/${decisionBoardAgentId}`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardAgent(data?.agent || data?.decisionBoardAgent || data);
};

export const addDecisionBoardBroker = async (decisionBoardId, payload = {}) => {
  requireId(decisionBoardId, 'decisionBoardId');

  const { data } = await api.post(
    `/api/decision-boards/${decisionBoardId}/brokers`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardBroker(data?.broker || data?.decisionBoardBroker || data);
};

export const deleteDecisionBoardBroker = async (decisionBoardId, decisionBoardBrokerId) => {
  requireId(decisionBoardId, 'decisionBoardId');
  requireId(decisionBoardBrokerId, 'decisionBoardBrokerId');

  const { data } = await api.delete(`/api/decision-boards/${decisionBoardId}/brokers/${decisionBoardBrokerId}`);
  return data || { success: true };
};

export const updateDecisionBoardBroker = async (decisionBoardId, decisionBoardBrokerId, payload = {}) => {
  requireId(decisionBoardId, 'decisionBoardId');
  requireId(decisionBoardBrokerId, 'decisionBoardBrokerId');

  const { data } = await api.patch(
    `/api/decision-boards/${decisionBoardId}/brokers/${decisionBoardBrokerId}`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardBroker(data?.broker || data?.decisionBoardBroker || data);
};

export const searchRealEstateAgents = async (query = '') => {
  const { data } = await api.get('/api/real-estate-agents', {
    params: compactPayload({ query }),
  });

  const agents = data?.realEstateAgents || data?.agents || data?.items || data?.data || data;
  return Array.isArray(agents) ? agents.map(normalizeDecisionBoardAgent).filter(Boolean) : [];
};

export const createRealEstateAgent = async (payload = {}) => {
  const { data } = await api.post('/api/real-estate-agents', compactPayload(payload));
  return normalizeDecisionBoardAgent(data?.realEstateAgent || data?.agent || data);
};

export const searchBrokers = async (query = '') => {
  const { data } = await api.get('/api/brokers', {
    params: compactPayload({ query }),
  });

  const brokers = data?.brokers || data?.items || data?.data || data;
  return Array.isArray(brokers) ? brokers.map(normalizeDecisionBoardBroker).filter(Boolean) : [];
};

export const createBroker = async (payload = {}) => {
  const { data } = await api.post('/api/brokers', compactPayload(payload));
  return normalizeDecisionBoardBroker(data?.broker || data?.mortgageBroker || data);
};

export const addDecisionBoardTimelineEvent = async (decisionBoardListingId, payload = {}) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');

  const { data } = await api.post(
    `/api/decision-board-listings/${decisionBoardListingId}/timeline`,
    compactPayload(payload)
  );

  return normalizeTimelineEvent(data?.timelineEvent || data?.event || data);
};

export const addDecisionBoardNote = async (decisionBoardListingId, payload = {}) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');

  const { data } = await api.post(
    `/api/decision-board-listings/${decisionBoardListingId}/notes`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardNote(data?.note || data);
};

export const updateDecisionBoardNote = async (decisionBoardListingId, noteId, payload = {}) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(noteId, 'noteId');

  const { data } = await api.patch(
    `/api/decision-board-listings/${decisionBoardListingId}/notes/${noteId}`,
    compactPayload(payload)
  );

  return normalizeDecisionBoardNote(data?.note || data);
};

export const deleteDecisionBoardNote = async (decisionBoardListingId, noteId) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(noteId, 'noteId');

  const { data } = await api.delete(`/api/decision-board-listings/${decisionBoardListingId}/notes/${noteId}`);
  return data || { success: true };
};

export const addDecisionBoardTask = async (decisionBoardListingId, payload = {}) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');

  const { data } = await api.post(
    `/api/decision-board-listings/${decisionBoardListingId}/tasks`,
    compactPayload(payload)
  );

  return normalizeTask(data?.task || data);
};

export const updateDecisionBoardTask = async (decisionBoardListingId, taskId, payload = {}) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(taskId, 'taskId');

  const { data } = await api.patch(
    `/api/decision-board-listings/${decisionBoardListingId}/tasks/${taskId}`,
    compactPayload(payload)
  );

  return normalizeTask(data?.task || data);
};

export const deleteDecisionBoardTask = async (decisionBoardListingId, taskId) => {
  requireId(decisionBoardListingId, 'decisionBoardListingId');
  requireId(taskId, 'taskId');

  const { data } = await api.delete(`/api/decision-board-listings/${decisionBoardListingId}/tasks/${taskId}`);
  return data || { success: true };
};

export const setDecisionBoardShared = async (decisionBoardId, isShared) => updateDecisionBoard(decisionBoardId, {
  isShared: Boolean(isShared),
});
