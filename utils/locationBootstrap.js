export const DEFAULT_UK_LOCATION = Object.freeze({
  latitude: 50.971399474,
  longitude: 0.250792957,
  label: 'Heathfield, East Sussex',
  source: 'default',
});

export const LOCATION_INIT_TIMEOUT_MS = 8000;

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const withTimeoutError = (label, timeoutMs) => {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`);
  error.code = 'LOCATION_TIMEOUT';
  return error;
};

export const withTimeout = (task, timeoutMs, label) => {
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(withTimeoutError(label, timeoutMs)), timeoutMs);
  });

  const taskPromise = Promise.resolve().then(() => (
    typeof task === 'function' ? task() : task
  ));

  return Promise.race([taskPromise, timeoutPromise]).finally(() => {
    if (timerId) clearTimeout(timerId);
  });
};

export const normalizeLocationCandidate = (location, defaults = {}) => {
  if (!location || typeof location !== 'object') return null;

  const latitude = toFiniteNumber(location.latitude ?? location.lat ?? location.Latitude);
  const longitude = toFiniteNumber(location.longitude ?? location.lng ?? location.lon ?? location.Longitude);

  if (latitude === null || longitude === null) return null;

  return {
    ...location,
    latitude,
    longitude,
    label: location.label || location.query || defaults.label || 'Current location',
    query: location.query || location.label || defaults.query || null,
    source: location.source || defaults.source || 'unknown',
  };
};

export const buildProfileLocationQuery = (userProfile = null) => {
  const parts = [
    userProfile?.Address ?? userProfile?.address,
    userProfile?.City ?? userProfile?.city,
    userProfile?.PostalCode ?? userProfile?.postalCode ?? userProfile?.Postcode ?? userProfile?.postcode,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : value))
    .filter(Boolean);

  return parts.join(', ');
};

export const resolveInitialMapLocation = async ({
  hasServicesEnabled,
  requestForegroundPermission,
  getCurrentPosition,
  getSavedLocation,
  getProfileLocation,
  defaultLocation = DEFAULT_UK_LOCATION,
  timeoutMs = LOCATION_INIT_TIMEOUT_MS,
  log = () => {},
} = {}) => {
  const result = {
    location: normalizeLocationCandidate(defaultLocation, { label: DEFAULT_UK_LOCATION.label, source: 'default' }) || DEFAULT_UK_LOCATION,
    searchLocation: null,
    source: 'default',
    permissionStatus: null,
    servicesEnabled: null,
    fallbackUsed: true,
  };

  const logStep = (step, details = {}) => {
    try {
      log(step, details);
    } catch {
      // Logging must never block location startup.
    }
  };

  logStep('init-start', {
    timeoutMs,
  });

  try {
    let servicesEnabled = true;
    if (typeof hasServicesEnabled === 'function') {
      try {
        servicesEnabled = await withTimeout(() => hasServicesEnabled(), timeoutMs, 'location-services-check');
      } catch (error) {
        servicesEnabled = false;
        logStep('services-check-failed', {
          message: error?.message || String(error),
        });
      }
    }

    result.servicesEnabled = servicesEnabled;
    logStep('services-check-result', { servicesEnabled });

    if (servicesEnabled && typeof requestForegroundPermission === 'function') {
      try {
        logStep('permission-request-start');
        const permission = await withTimeout(
          () => requestForegroundPermission(),
          timeoutMs,
          'location-permission-request'
        );
        result.permissionStatus = permission?.status || null;
        logStep('permission-request-result', {
          status: result.permissionStatus || 'unknown',
        });

        if (result.permissionStatus === 'granted' && typeof getCurrentPosition === 'function') {
          try {
            logStep('current-location-start');
            const current = await withTimeout(
              () => getCurrentPosition(),
              timeoutMs,
              'current-location'
            );
            const normalizedCurrent = normalizeLocationCandidate(current?.coords ? {
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
              label: 'Current location',
              source: 'current',
            } : current, { label: 'Current location', source: 'current' });

            if (normalizedCurrent) {
              logStep('current-location-success', {
                latitude: normalizedCurrent.latitude,
                longitude: normalizedCurrent.longitude,
              });
              return {
                ...result,
                location: normalizedCurrent,
                searchLocation: null,
                source: 'current',
                fallbackUsed: false,
              };
            }

            logStep('current-location-invalid');
          } catch (error) {
            const isTimeout = error?.code === 'LOCATION_TIMEOUT';
            logStep(isTimeout ? 'location-timeout' : 'current-location-failure', {
              message: error?.message || String(error),
            });
          }
        } else {
          logStep('permission-denied-or-unavailable', {
            status: result.permissionStatus || 'unknown',
          });
        }
      } catch (error) {
        logStep('permission-request-failure', {
          message: error?.message || String(error),
        });
      }
    }

    if (typeof getSavedLocation === 'function') {
      try {
        const savedLocation = normalizeLocationCandidate(await getSavedLocation(), {
          label: 'Saved location',
          source: 'saved',
        });
        if (savedLocation) {
          logStep('fallback-saved-location', {
            latitude: savedLocation.latitude,
            longitude: savedLocation.longitude,
          });
          return {
            ...result,
            location: savedLocation,
            searchLocation: savedLocation,
            source: 'saved',
            fallbackUsed: true,
          };
        }
      } catch (error) {
        logStep('saved-location-failure', {
          message: error?.message || String(error),
        });
      }
    }

    if (typeof getProfileLocation === 'function') {
      try {
        const profileLocation = normalizeLocationCandidate(await getProfileLocation(), {
          label: 'Profile location',
          source: 'profile',
        });
        if (profileLocation) {
          logStep('fallback-profile-location', {
            latitude: profileLocation.latitude,
            longitude: profileLocation.longitude,
          });
          return {
            ...result,
            location: profileLocation,
            searchLocation: profileLocation,
            source: 'profile',
            fallbackUsed: true,
          };
        }
      } catch (error) {
        logStep('profile-location-failure', {
          message: error?.message || String(error),
        });
      }
    }

    logStep('fallback-default-location', {
      latitude: result.location.latitude,
      longitude: result.location.longitude,
    });

    return result;
  } finally {
    logStep('final-loading-cleared');
  }
};
