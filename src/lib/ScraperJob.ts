import type { VersionedData } from "./VersionedData";

export type ScraperJob<T, ID> =
  | {
      isAtomic: true;
      name: string;
      version: string;
      outputPath: string;
      fetchAll(): Promise<T>;
    }
  | {
      isAtomic: false;
      name: string;
      version: string;
      listItems(): Promise<ID[]>;
      fetchItem(id: ID): Promise<T>;
      getPath(id: ID): string;
      isItemStale?: (item: VersionedData<T>) => boolean;
    };
