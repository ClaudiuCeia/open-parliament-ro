const HOURS_BEFORE_STALE = 6;

type TimestampedObject = {
  lastUpdated: string;
};

export const isStale = <T extends TimestampedObject>(obj: T): boolean => {
  const lastUpdatedDate = new Date(obj.lastUpdated);
  const now = new Date();

  return (
    now.getTime() - lastUpdatedDate.getTime() >
    HOURS_BEFORE_STALE * 60 * 60 * 1000
  );
};
