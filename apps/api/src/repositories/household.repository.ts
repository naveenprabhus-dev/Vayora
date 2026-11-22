import type { HouseholdLifestyleInput, HouseholdLifestyleRecord } from '@uaqa/contracts';

export interface StoredHouseholdProfile extends HouseholdLifestyleRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HouseholdRepository {
  findByOwnerUid(ownerUid: string): Promise<StoredHouseholdProfile | null>;
  upsertForOwner(ownerUid: string, input: HouseholdLifestyleInput): Promise<StoredHouseholdProfile>;
}

/**
 * Ownership-isolated in-memory household repository for backend API contracts
 * and deterministic integration tests. On Google-hosted Starter Tier projects,
 * persistent Firestore writes execute via the client SDK under firestore.rules.
 */
export class InMemoryHouseholdRepository implements HouseholdRepository {
  private readonly records = new Map<string, StoredHouseholdProfile>();

  public async findByOwnerUid(ownerUid: string): Promise<StoredHouseholdProfile | null> {
    return this.records.get(ownerUid) ?? null;
  }

  public async upsertForOwner(
    ownerUid: string,
    input: HouseholdLifestyleInput,
  ): Promise<StoredHouseholdProfile> {
    const existing = this.records.get(ownerUid);
    const now = new Date().toISOString();

    const record: StoredHouseholdProfile = {
      ...input,
      id: ownerUid,
      ownerUid,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.records.set(ownerUid, record);
    return record;
  }
}
