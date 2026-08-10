export const PULL_TO_REFRESH_ACTIVATION_PX = 8;
export const PULL_TO_REFRESH_AXIS_RATIO = 1.2;
export const PULL_TO_REFRESH_TRIGGER_PX = 88;
export const PULL_TO_REFRESH_MAX_RAW_PX = 160;
export const PULL_TO_REFRESH_MAX_VISUAL_PX = 80;
export const PULL_TO_REFRESH_HOLD_PX = 52;

export type PullGestureIntent = "cancel" | "pending" | "pull";

export function getPullGestureIntent({
  deltaX,
  deltaY,
}: {
  deltaX: number;
  deltaY: number;
}): PullGestureIntent {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (
    horizontalDistance < PULL_TO_REFRESH_ACTIVATION_PX &&
    verticalDistance < PULL_TO_REFRESH_ACTIVATION_PX
  ) {
    return "pending";
  }

  if (
    deltaY <= 0 ||
    deltaY < horizontalDistance * PULL_TO_REFRESH_AXIS_RATIO
  ) {
    return "cancel";
  }

  return "pull";
}

export function getResistedPullDistance(rawDistance: number) {
  const clampedDistance = Math.min(
    Math.max(rawDistance, 0),
    PULL_TO_REFRESH_MAX_RAW_PX,
  );

  return Math.min(
    clampedDistance * 0.55,
    PULL_TO_REFRESH_MAX_VISUAL_PX,
  );
}

export function isPullToRefreshArmed(rawDistance: number) {
  return rawDistance >= PULL_TO_REFRESH_TRIGGER_PX;
}
