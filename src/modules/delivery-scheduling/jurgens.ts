import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

const johannesburgTimeZone = "Africa/Johannesburg";
const scheduleHorizonDays = 14;

const defaultWindows = [
  { label: "Morning", start: "09:00", end: "12:00" },
  { label: "Afternoon", start: "12:00", end: "16:00" },
  { label: "Late afternoon", start: "16:00", end: "18:00" },
] as const;

export type JurgensDeliveryScheduleOption = {
  date: string;
  dateLabel: string;
  isSameDay: boolean;
  value: string;
  windowEnd: string;
  windowLabel: string;
  windowStart: string;
};

export type JurgensDeliveryScheduleSelection = {
  date: string;
  deliveryInstructions?: string | null;
  windowEnd: string;
  windowLabel: string;
  windowStart: string;
};

export async function getJurgensDeliveryScheduleOptions({
  now = new Date(),
}: {
  now?: Date;
} = {}) {
  const settings = await getMarketplaceSettings();

  return buildJurgensDeliveryScheduleOptions({
    cutoffTime: settings.jurgensDeliveryCutoffTime,
    now,
  });
}

export function buildJurgensDeliveryScheduleOptions({
  cutoffTime,
  now = new Date(),
}: {
  cutoffTime: string;
  now?: Date;
}): JurgensDeliveryScheduleOption[] {
  const localNow = getJohannesburgNowParts(now);
  const today = localNow.date;
  const sameDayAllowed =
    timeToMinutes(`${pad2(localNow.hour)}:${pad2(localNow.minute)}`) <
    timeToMinutes(cutoffTime);
  const firstOffset = sameDayAllowed ? 0 : 1;
  const options: JurgensDeliveryScheduleOption[] = [];

  for (let dayOffset = firstOffset; dayOffset < scheduleHorizonDays; dayOffset += 1) {
    const date = addDays(today, dayOffset);
    const isSameDay = dayOffset === 0;

    for (const window of defaultWindows) {
      options.push({
        date,
        dateLabel: getDateLabel(date, today, dayOffset),
        isSameDay,
        value: createScheduleOptionValue({
          date,
          windowEnd: window.end,
          windowLabel: window.label,
          windowStart: window.start,
        }),
        windowEnd: window.end,
        windowLabel: window.label,
        windowStart: window.start,
      });
    }
  }

  return options;
}

export async function validateJurgensDeliveryScheduleSelection(
  selection: JurgensDeliveryScheduleSelection | null | undefined,
) {
  if (!selection) {
    return {
      ok: false,
      message: "Choose a delivery date and time window for Jurgens delivery.",
    } as const;
  }

  const options = await getJurgensDeliveryScheduleOptions();
  const match = options.find(
    (option) =>
      option.date === selection.date &&
      option.windowStart === selection.windowStart &&
      option.windowEnd === selection.windowEnd &&
      option.windowLabel === selection.windowLabel,
  );

  if (!match) {
    return {
      ok: false,
      message:
        "That Jurgens delivery slot is no longer available. Choose a new delivery window.",
    } as const;
  }

  return {
    ok: true,
    selection: {
      date: match.date,
      deliveryInstructions: selection.deliveryInstructions?.trim() || null,
      windowEnd: match.windowEnd,
      windowLabel: match.windowLabel,
      windowStart: match.windowStart,
    },
  } as const;
}

export function createScheduleOptionValue(
  selection: Omit<JurgensDeliveryScheduleSelection, "deliveryInstructions">,
) {
  return [
    selection.date,
    selection.windowStart,
    selection.windowEnd,
    selection.windowLabel,
  ].join("|");
}

export function parseScheduleOptionValue(value: string) {
  const [date, windowStart, windowEnd, windowLabel] = value.split("|");

  if (!date || !windowStart || !windowEnd || !windowLabel) {
    return null;
  }

  return { date, windowEnd, windowLabel, windowStart };
}

export function formatScheduleDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeZone: johannesburgTimeZone,
  }).format(new Date(`${date}T00:00:00+02:00`));
}

export function formatScheduleWindow({
  windowEnd,
  windowLabel,
  windowStart,
}: {
  windowEnd: string;
  windowLabel: string;
  windowStart: string;
}) {
  return `${windowLabel} (${windowStart}-${windowEnd})`;
}

function getJohannesburgNowParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: johannesburgTimeZone,
    year: "numeric",
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00+02:00`);
  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}

function getDateLabel(date: string, today: string, dayOffset: number) {
  if (date === today) {
    return "Today";
  }

  if (dayOffset === 1) {
    return "Tomorrow";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: johannesburgTimeZone,
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+02:00`));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}
