export const LEAD_HOT_THRESHOLD_HOURS = 24;
export const LEAD_FREEZING_THRESHOLD_HOURS = 72;

export const getHoursSinceLeadInteraction = (lastInteraction?: string | null): number | null => {
  if (!lastInteraction) return null;

  const lastInteractionTime = new Date(lastInteraction).getTime();
  if (Number.isNaN(lastInteractionTime)) return null;

  return (Date.now() - lastInteractionTime) / (1000 * 60 * 60);
};
