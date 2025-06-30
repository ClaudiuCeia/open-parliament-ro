import type { VersionedData } from "./VersionedData";

export async function readCache<T>(
  path: string,
): Promise<VersionedData<T> | null> {
  try {
    const file = Bun.file(path);
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeCache<T>(path: string, data: VersionedData<T>) {
  await Bun.write(path, JSON.stringify(data, null, 2));
}

export function isCacheValid<T>(
  cached: VersionedData<T> | null,
  version: string,
  maxAgeMs: number,
): boolean {
  if (!cached) return false;
  if (cached.version !== version) return false;
  const age = Date.now() - new Date(cached.lastUpdated).getTime();
  return age < maxAgeMs;
}
