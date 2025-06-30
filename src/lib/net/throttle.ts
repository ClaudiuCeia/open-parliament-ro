export const throttle = (ms: number) =>
  new Promise((res) => setTimeout(res, ms));
