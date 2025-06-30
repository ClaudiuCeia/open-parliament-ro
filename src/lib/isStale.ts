type TimestampedObject = {
  lastUpdated: string;
};

export const isStale = <T extends TimestampedObject>(obj: T): boolean => {
  const lastUpdatedDate = new Date(obj.lastUpdated);
  const now = new Date();

  // Check if the last updated date is more than 24 hours old
  return now.getTime() - lastUpdatedDate.getTime() > 24 * 60 * 60 * 1000;
};
