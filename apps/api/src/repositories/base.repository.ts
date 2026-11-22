export interface OwnedRecord {
  readonly id: string;
  readonly ownerUid: string;
}

/**
 * Repository abstraction for user-owned persistent records.
 * Concrete Firestore repositories in Phase 1+ must enforce ownerUid equality
 * in both application logic and Firestore Security Rules.
 */
export interface OwnedEntityRepository<TEntity extends OwnedRecord, TCreateInput, TUpdateInput> {
  findByIdForOwner(id: string, ownerUid: string): Promise<TEntity | null>;
  listByOwner(ownerUid: string, limit?: number): Promise<readonly TEntity[]>;
  createForOwner(ownerUid: string, input: TCreateInput): Promise<TEntity>;
  updateForOwner(id: string, ownerUid: string, input: TUpdateInput): Promise<TEntity | null>;
  deleteForOwner(id: string, ownerUid: string): Promise<boolean>;
}
