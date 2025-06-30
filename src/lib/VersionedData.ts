export type VersionedData<T> = {
  version: string;
  lastUpdated: string;
  data: T;
};
