export const STORY_TAB_BOTTOM_PADDING = 142;

export function getStoryHeroHeight(screenHeight, { min = 500, max = 570, ratio = 0.56 } = {}) {
  if (!screenHeight) return max;
  return Math.min(max, Math.max(min, Math.round(screenHeight * ratio)));
}
