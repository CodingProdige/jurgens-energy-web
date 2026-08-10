export type MarketplaceSaleCountdownDisplay = {
  accessible: string;
  visual: string;
};

export function getMarketplaceSaleCountdownDisplay(
  remainingMilliseconds: number,
): MarketplaceSaleCountdownDisplay {
  const totalSeconds = Math.max(0, Math.ceil(remainingMilliseconds / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const visualParts = [
    days > 0 ? `${days}d` : null,
    days > 0 || hours > 0 ? `${String(hours).padStart(2, "0")}h` : null,
    days > 0 || hours > 0 || minutes > 0
      ? `${String(minutes).padStart(2, "0")}m`
      : null,
    `${String(seconds).padStart(2, "0")}s`,
  ].filter((part): part is string => Boolean(part));
  const accessibleParts = [
    days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : null,
    days > 0 || hours > 0
      ? `${hours} ${hours === 1 ? "hour" : "hours"}`
      : null,
    days > 0 || hours > 0 || minutes > 0
      ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
      : null,
    `${seconds} ${seconds === 1 ? "second" : "seconds"}`,
  ].filter((part): part is string => Boolean(part));

  return {
    accessible: accessibleParts.join(", "),
    visual: visualParts.join(" "),
  };
}
