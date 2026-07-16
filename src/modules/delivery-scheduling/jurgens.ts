import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

const johannesburgTimeZone = "Africa/Johannesburg";
const scheduleHorizonDays = 14;

export type JurgensDeliveryScheduleOption = {
  date: string;
  dateLabel: string;
  isSameDay: boolean;
};

export type JurgensDeliveryScheduleSelection = {
  date: string;
  deliveryInstructions?: string | null;
};

export type JurgensDeliveryScheduleAvailability = {
  cutoffTime: string;
  cutoffTimeZone: typeof johannesburgTimeZone;
  nextPolicyChangeAt: string | null;
  options: JurgensDeliveryScheduleOption[];
};

export async function getJurgensDeliveryScheduleAvailability({
  now = new Date(),
}: {
  now?: Date;
} = {}): Promise<JurgensDeliveryScheduleAvailability> {
  const settings = await getMarketplaceSettings();

  return buildJurgensDeliveryScheduleAvailability({
    cutoffTime: settings.jurgensDeliveryCutoffTime,
    now,
  });
}

export async function getJurgensDeliveryScheduleOptions({
  now = new Date(),
}: {
  now?: Date;
} = {}) {
  const availability = await getJurgensDeliveryScheduleAvailability({ now });

  return availability.options;
}

export function buildJurgensDeliveryScheduleAvailability({
  cutoffTime,
  now = new Date(),
}: {
  cutoffTime: string;
  now?: Date;
}): JurgensDeliveryScheduleAvailability {
  const normalizedCutoffTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(cutoffTime)
    ? cutoffTime
    : "14:00";
  const localNow = getJohannesburgNowParts(now);
  const today = localNow.date;
  const sameDayAllowed =
    timeToMinutes(`${pad2(localNow.hour)}:${pad2(localNow.minute)}`) <
    timeToMinutes(normalizedCutoffTime);
  const firstOffset = sameDayAllowed ? 0 : 1;
  const options: JurgensDeliveryScheduleOption[] = [];

  for (let index = 0; index < scheduleHorizonDays; index += 1) {
    const dayOffset = firstOffset + index;
    const date = addDays(today, dayOffset);
    const isSameDay = dayOffset === 0;

    options.push({
      date,
      dateLabel: getDateLabel(date, today, dayOffset),
      isSameDay,
    });
  }

  return {
    cutoffTime: normalizedCutoffTime,
    cutoffTimeZone: johannesburgTimeZone,
    nextPolicyChangeAt: sameDayAllowed
      ? new Date(`${today}T${normalizedCutoffTime}:00+02:00`).toISOString()
      : null,
    options,
  };
}

export function buildJurgensDeliveryScheduleOptions({
  cutoffTime,
  now = new Date(),
}: {
  cutoffTime: string;
  now?: Date;
}): JurgensDeliveryScheduleOption[] {
  return buildJurgensDeliveryScheduleAvailability({ cutoffTime, now }).options;
}

export async function validateJurgensDeliveryScheduleSelection(
  selection: JurgensDeliveryScheduleSelection | null | undefined,
) {
  if (!selection) {
    return {
      ok: false,
      message: "Choose a valid date for Jurgens Energy delivery.",
    } as const;
  }

  const options = await getJurgensDeliveryScheduleOptions();
  const match = options.find((option) => option.date === selection.date);

  if (!match) {
    return {
      ok: false,
      message:
        "That Jurgens Energy delivery date is no longer available. Choose another date.",
    } as const;
  }

  return {
    ok: true,
    selection: {
      date: match.date,
      deliveryInstructions: selection.deliveryInstructions?.trim() || null,
    },
  } as const;
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
  windowEnd: string | null;
  windowLabel: string | null;
  windowStart: string | null;
}) {
  if (!windowEnd || !windowLabel || !windowStart) {
    return null;
  }

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
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));

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
