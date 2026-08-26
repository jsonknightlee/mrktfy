import {
  DEFAULT_UK_LOCATION,
  LOCATION_INIT_TIMEOUT_MS,
  buildProfileLocationQuery,
  resolveInitialMapLocation,
  withTimeout,
} from '../utils/locationBootstrap';

describe('location bootstrap', () => {
  it('uses the current location when permission is granted and GPS succeeds', async () => {
    const result = await resolveInitialMapLocation({
      hasServicesEnabled: async () => true,
      requestForegroundPermission: async () => ({ status: 'granted' }),
      getCurrentPosition: async () => ({ coords: { latitude: 51.501, longitude: -0.141 } }),
      getSavedLocation: async () => null,
      getProfileLocation: async () => null,
      timeoutMs: 50,
    });

    expect(result.source).toBe('current');
    expect(result.location.latitude).toBe(51.501);
    expect(result.location.longitude).toBe(-0.141);
    expect(result.fallbackUsed).toBe(false);
  });

  it('falls back to a saved location when permission is denied', async () => {
    const result = await resolveInitialMapLocation({
      hasServicesEnabled: async () => true,
      requestForegroundPermission: async () => ({ status: 'denied' }),
      getCurrentPosition: async () => ({ coords: { latitude: 0, longitude: 0 } }),
      getSavedLocation: async () => ({ latitude: 53.48, longitude: -2.24, label: 'Manchester', source: 'saved' }),
      getProfileLocation: async () => null,
      timeoutMs: 50,
    });

    expect(result.source).toBe('saved');
    expect(result.location.label).toBe('Manchester');
    expect(result.searchLocation.label).toBe('Manchester');
  });

  it('falls back to a saved location when the current location request throws', async () => {
    const result = await resolveInitialMapLocation({
      hasServicesEnabled: async () => true,
      requestForegroundPermission: async () => ({ status: 'granted' }),
      getCurrentPosition: async () => {
        throw new Error('gps failed');
      },
      getSavedLocation: async () => ({ latitude: 55.9533, longitude: -3.1883, label: 'Edinburgh', source: 'saved' }),
      getProfileLocation: async () => null,
      timeoutMs: 50,
    });

    expect(result.source).toBe('saved');
    expect(result.location.label).toBe('Edinburgh');
  });

  it('falls back to a profile location when GPS times out', async () => {
    const result = await resolveInitialMapLocation({
      hasServicesEnabled: async () => true,
      requestForegroundPermission: async () => ({ status: 'granted' }),
      getCurrentPosition: async () => new Promise(() => {}),
      getSavedLocation: async () => null,
      getProfileLocation: async () => ({ latitude: 51.4545, longitude: -2.5879, label: 'Bristol, UK', source: 'profile' }),
      timeoutMs: 20,
    });

    expect(result.source).toBe('profile');
    expect(result.location.label).toBe('Bristol, UK');
    expect(result.searchLocation.label).toBe('Bristol, UK');
  });

  it('falls back cleanly when permissions are unavailable', async () => {
    const result = await resolveInitialMapLocation({
      hasServicesEnabled: async () => true,
      requestForegroundPermission: async () => ({ status: 'undetermined' }),
      getCurrentPosition: async () => {
        throw new Error('should not be called');
      },
      getSavedLocation: async () => null,
      getProfileLocation: async () => null,
      timeoutMs: 50,
    });

    expect(result.source).toBe('default');
    expect(result.location.label).toBe(DEFAULT_UK_LOCATION.label);
  });

  it('falls back to the UK default when no location can be resolved', async () => {
    const result = await resolveInitialMapLocation({
      hasServicesEnabled: async () => false,
      requestForegroundPermission: async () => ({ status: 'denied' }),
      getCurrentPosition: async () => { throw new Error('should not be called'); },
      getSavedLocation: async () => null,
      getProfileLocation: async () => null,
      timeoutMs: 50,
    });

    expect(result.source).toBe('default');
    expect(result.location.latitude).toBe(DEFAULT_UK_LOCATION.latitude);
    expect(result.location.longitude).toBe(DEFAULT_UK_LOCATION.longitude);
    expect(result.location.label).toBe(DEFAULT_UK_LOCATION.label);
  });

  it('builds a profile location query from profile fields', () => {
    expect(buildProfileLocationQuery({
      Address: '10 Downing Street',
      City: 'London',
      Postcode: 'SW1A 2AA',
    })).toBe('10 Downing Street, London, SW1A 2AA');
  });

  it('times out long-running work', async () => {
    await expect(
      withTimeout(() => new Promise(() => {}), 10, 'test-task')
    ).rejects.toMatchObject({
      code: 'LOCATION_TIMEOUT',
    });
  });

  it('exposes the configured bootstrap timeout constant', () => {
    expect(LOCATION_INIT_TIMEOUT_MS).toBe(8000);
  });
});
