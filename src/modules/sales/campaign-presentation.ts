export const defaultSaleCampaignColor = "#FF5A1F";

export function normalizeSaleCampaignColor(value: string | null | undefined) {
  const normalizedValue = value?.trim().toUpperCase();

  return normalizedValue && /^#[0-9A-F]{6}$/.test(normalizedValue)
    ? normalizedValue
    : defaultSaleCampaignColor;
}

function toLinearChannel(channel: number) {
  const normalized = channel / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function getReadableSaleCampaignForeground(backgroundColor: string) {
  const normalizedColor = normalizeSaleCampaignColor(backgroundColor);
  const red = Number.parseInt(normalizedColor.slice(1, 3), 16);
  const green = Number.parseInt(normalizedColor.slice(3, 5), 16);
  const blue = Number.parseInt(normalizedColor.slice(5, 7), 16);
  const luminance =
    0.2126 * toLinearChannel(red) +
    0.7152 * toLinearChannel(green) +
    0.0722 * toLinearChannel(blue);
  const contrastWithInk = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithInk >= contrastWithWhite ? "#080808" : "#FFFFFF";
}
