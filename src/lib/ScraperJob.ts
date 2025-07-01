import type { VersionedData } from "./VersionedData";

export interface DataPackageMetadata {
  name: string;
  title: string;
  description: string;
}

export interface DataPackageResource {
  name: string;
  path: string;
  format: "json";
  description?: string;
  schema?: string;
}

export type ScraperJob<T, ID> =
  | {
      isAtomic: true;
      version: string;
      outputPath: string;
      fetchAll(): Promise<T>;
      datapackage: DataPackageMetadata;
    }
  | {
      isAtomic: false;
      version: string;
      listItems(): Promise<ID[]>;
      fetchItem(id: ID): Promise<T>;
      getPath(id: ID): string;
      isItemStale?: (item: VersionedData<T>) => boolean;
      datapackage: DataPackageMetadata;
    };
