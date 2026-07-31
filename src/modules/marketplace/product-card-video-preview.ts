export const PRODUCT_CARD_VIDEO_HOVER_DELAY_MS = 200;
export const PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS = 1_000;

export type ProductCardVideoAutoplayConditions = {
  effectiveConnectionType: string | null;
  prefersReducedMotion: boolean;
  saveData: boolean;
  supportsFineHover: boolean;
};

export type ProductCardVideoPointerPosition = {
  clientX: number;
  clientY: number;
};

export type ProductCardVideoPreviewBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function canAutoplayProductCardVideo({
  effectiveConnectionType,
  prefersReducedMotion,
  saveData,
  supportsFineHover,
}: ProductCardVideoAutoplayConditions) {
  return (
    supportsFineHover &&
    !prefersReducedMotion &&
    !saveData &&
    effectiveConnectionType !== "slow-2g" &&
    effectiveConnectionType !== "2g"
  );
}

export function isPointerInsideProductCardVideo(
  position: ProductCardVideoPointerPosition,
  bounds: ProductCardVideoPreviewBounds,
) {
  return (
    position.clientX >= bounds.left &&
    position.clientX <= bounds.right &&
    position.clientY >= bounds.top &&
    position.clientY <= bounds.bottom
  );
}
