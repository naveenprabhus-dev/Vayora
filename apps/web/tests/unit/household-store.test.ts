import { afterEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockQuery = vi.fn((...args: unknown[]) => ({ type: 'query', args }));
const mockCollection = vi.fn((_db: unknown, name: string) => ({ type: 'collection', name }));
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => ({
  type: 'doc',
  path: segments.join('/'),
}));
const mockWhere = vi.fn((field: string, op: string, value: unknown) => ({
  type: 'where',
  field,
  op,
  value,
}));
const mockLimit = vi.fn((count: number) => ({ type: 'limit', count }));
const mockServerTimestamp = vi.fn(() => ({ type: 'serverTimestamp' }));

vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: (d: Date) => ({ type: 'timestamp', iso: d.toISOString() }),
  },
  collection: (...args: unknown[]) => mockCollection(...(args as [unknown, string])),
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, ...string[]])),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: (n: number) => mockLimit(n),
  query: (...args: unknown[]) => mockQuery(...args),
  serverTimestamp: () => mockServerTimestamp(),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: (field: string, op: string, value: unknown) => mockWhere(field, op, value),
}));

vi.mock('../../src/lib/firebaseFirestore.ts', () => ({
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  },
  getFirestoreDb: () => ({ mockDb: true }),
  handleFirestoreError: (error: unknown, operationType: string, path: string | null) => {
    throw new Error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        operationType,
        path,
      }),
    );
  },
}));

import { FirestoreHouseholdStore } from '../../src/lib/householdStore.ts';

const VALID_INPUT = {
  country: 'Poland',
  city: 'Krakow',
  neighborhood: 'Krowodrza',
  postalPrefix: '30-01',
  locationPreferences: {
    primaryZoneType: 'urban_core' as const,
    alertsEnabled: true,
  },
  householdSize: 3,
  householdComposition: ['adults' as const],
  primaryCommuteMode: 'public_transit' as const,
  outdoorActivityPattern: 'morning_commute' as const,
  ventilationContext: 'natural_windows' as const,
  hasIndoorAirPurifier: false,
  heatingType: 'district' as const,
  lifestylePreferences: {
    preferredGuidanceFocus: 'balanced' as const,
    reminderCadence: 'daily_smog_alerts' as const,
  },
  onboardingCompleted: true,
};

describe('FirestoreHouseholdStore regression (non-existent household lookup)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses ownerUid-scoped query lookup instead of getDoc for missing household profiles', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

    const store = new FirestoreHouseholdStore();
    const profile = await store.getHouseholdProfile('uid_new_user');

    expect(profile).toBeNull();
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalledWith('ownerUid', '==', 'uid_new_user');
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('creates a new household document via setDoc when query lookup finds no existing record', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const store = new FirestoreHouseholdStore();
    const saved = await store.saveHouseholdProfile('uid_new_user', VALID_INPUT);

    expect(saved.ownerUid).toBe('uid_new_user');
    expect(saved.city).toBe('Krakow');
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('updates an existing household document via updateDoc without overwriting immutable ownerUid', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          exists: () => true,
          data: () => ({ ownerUid: 'uid_existing', ...VALID_INPUT }),
        },
      ],
    });
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    const store = new FirestoreHouseholdStore();
    await store.saveHouseholdProfile('uid_existing', { ...VALID_INPUT, city: 'Warsaw' });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updatePayload.city).toBe('Warsaw');
    expect('ownerUid' in updatePayload).toBe(false);
    expect('createdAt' in updatePayload).toBe(false);
  });
});
