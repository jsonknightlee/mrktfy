import { api } from './api';

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return String(value)
      .split(/[,|;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const serializeList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return parseJsonArray(value);
};

const requestWithPathFallback = async (method, paths, ...args) => {
  let lastError;

  for (const path of paths) {
    try {
      return await api[method](path, ...args);
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
};

const BUYER_PREFERENCE_PATHS = [
  '/api/onboarding/buyer-preferences',
  '/api/onboarding/onboarding/buyer-preferences',
  '/api/buyer-preferences',
  '/onboarding/buyer-preferences',
];

const BUYER_PREFERENCE_SKIP_PATHS = [
  '/api/onboarding/buyer-preferences/skip',
  '/api/onboarding/onboarding/buyer-preferences/skip',
  '/api/buyer-preferences/skip',
  '/onboarding/buyer-preferences/skip',
];

export const normalizeBuyerPreference = (preference) => {
  if (!preference) return null;

  return {
    id: preference.id ?? preference.ID ?? null,
    userId: preference.userId ?? preference.UserID ?? null,
    propertyDeckId: preference.propertyDeckId ?? preference.PropertyDeckID ?? preference.PropertyDeckId ?? null,
    isActive: Boolean(preference.isActive ?? preference.IsActive ?? true),
    onboardingStatus: preference.onboardingStatus ?? preference.OnboardingStatus ?? 'NotStarted',
    maxBudget: preference.maxBudget ?? preference.MaxBudget ?? '',
    minBedrooms: preference.minBedrooms ?? preference.MinBedrooms ?? '',
    minBathrooms: preference.minBathrooms ?? preference.MinBathrooms ?? '',
    preferredAreasJson: parseJsonArray(preference.preferredAreasJson ?? preference.PreferredAreasJson),
    maxCommuteMinutes: preference.maxCommuteMinutes ?? preference.MaxCommuteMinutes ?? '',
    commuteDestination: preference.commuteDestination ?? preference.CommuteDestination ?? '',
    schoolImportance: preference.schoolImportance ?? preference.SchoolImportance ?? 0,
    parkingImportance: preference.parkingImportance ?? preference.ParkingImportance ?? 0,
    gardenImportance: preference.gardenImportance ?? preference.GardenImportance ?? 0,
    quietAreaImportance: preference.quietAreaImportance ?? preference.QuietAreaImportance ?? 0,
    renovationTolerance: preference.renovationTolerance ?? preference.RenovationTolerance ?? 0,
    propertyTypesJson: parseJsonArray(preference.propertyTypesJson ?? preference.PropertyTypesJson),
    mustHaveJson: parseJsonArray(preference.mustHaveJson ?? preference.MustHaveJson),
    niceToHaveJson: parseJsonArray(preference.niceToHaveJson ?? preference.NiceToHaveJson),
    createdAt: preference.createdAt ?? preference.CreatedAt ?? null,
    updatedAt: preference.updatedAt ?? preference.UpdatedAt ?? null,
  };
};

export const getBuyerPreferences = async (propertyDeckId = null) => {
  const config = propertyDeckId ? { params: { propertyDeckId } } : undefined;
  const { data } = await requestWithPathFallback('get', BUYER_PREFERENCE_PATHS, config);
  return normalizeBuyerPreference(data?.preference ?? data);
};

export const saveBuyerPreferences = async (preference) => {
  const payload = {
    maxBudget: preference.maxBudget || null,
    propertyDeckId: preference.propertyDeckId || null,
    minBedrooms: preference.minBedrooms || null,
    minBathrooms: preference.minBathrooms || null,
    preferredAreasJson: serializeList(preference.preferredAreasJson),
    maxCommuteMinutes: preference.maxCommuteMinutes || null,
    commuteDestination: preference.commuteDestination || null,
    schoolImportance: preference.schoolImportance ?? null,
    parkingImportance: preference.parkingImportance ?? null,
    gardenImportance: preference.gardenImportance ?? null,
    quietAreaImportance: preference.quietAreaImportance ?? null,
    renovationTolerance: preference.renovationTolerance ?? null,
    propertyTypesJson: serializeList(preference.propertyTypesJson),
    mustHaveJson: serializeList(preference.mustHaveJson),
    niceToHaveJson: serializeList(preference.niceToHaveJson),
  };

  let response;
  try {
    response = await requestWithPathFallback('put', BUYER_PREFERENCE_PATHS, payload);
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
    response = await requestWithPathFallback('post', BUYER_PREFERENCE_PATHS, payload);
  }

  const { data } = response;
  return normalizeBuyerPreference(data?.preference ?? data);
};

export const skipBuyerPreferences = async (propertyDeckId = null) => {
  const payload = propertyDeckId ? { propertyDeckId } : {};
  const { data } = await requestWithPathFallback('post', BUYER_PREFERENCE_SKIP_PATHS, payload);
  return normalizeBuyerPreference(data?.preference ?? data);
};
