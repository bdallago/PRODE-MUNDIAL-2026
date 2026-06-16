import { MATCHES } from "../data";
import { adminDb } from "./firebaseAdmin";

export type NotificationChannel = "google_chat" | "slack" | "teams";

export interface Match {
  id: string;
  home: string;
  away: string;
  date: string;
  time: string;
  group?: string;
}

const MONTHS_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DAY_NAMES_ES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

function kickoffUTC(dateStr: string, timeStr: string): number {
  const parts = dateStr.split(" ");
  const day = parseInt(parts[0]);
  const month = MONTHS_ES[parts[2].toLowerCase()];
  const [h, m] = timeStr.split(":").map(Number);
  return Date.UTC(2026, month, day, h + 3, m);
}

export function formatMatchTime(artTime: string): string {
  return artTime.split(":")[0].replace(/^0/, "");
}

export function getTodayMatches(): Match[] {
  const now = new Date();
  const artDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const todayDay = artDate.getDate();
  const todayMonth = MONTH_NAMES_ES[artDate.getMonth()];
  const todayStr = `${todayDay} de ${todayMonth}`;

  return (MATCHES as Match[]).filter((m) => m.date === todayStr);
}

export function getEarlyNextDayMatches(): Match[] {
  const now = new Date();
  const artDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const tomorrow = new Date(artDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getDate()} de ${MONTH_NAMES_ES[tomorrow.getMonth()]}`;

  return (MATCHES as Match[]).filter((m) => {
    if (m.date !== tomorrowStr) return false;
    const [h] = m.time.split(":").map(Number);
    return h >= 0 && h <= 2;
  });
}

export function formatMorningMessage(matches: Match[], trasnochados: Match[] = []): string {
  const now = new Date();
  const artDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const dayName = DAY_NAMES_ES[artDate.getDay()];
  const dayNum = artDate.getDate();
  const monthName = MONTH_NAMES_ES[artDate.getMonth()];

  const sorted = [...matches].sort((a, b) => a.time.localeCompare(b.time));
  const lines = sorted.map((m) => {
    const artHour = formatMatchTime(m.time);
    return `⚽ ${m.home} vs ${m.away} a las ${artHour}hs`;
  });

  const trasnochadoLines = trasnochados.length > 0
    ? [
        "",
        "Y para los más trasnochados:",
        ...trasnochados.sort((a, b) => a.time.localeCompare(b.time)).map((m) => {
          const artHour = formatMatchTime(m.time);
          return `⚽ ${m.home} vs ${m.away} a la ${artHour}hs`;
        }),
      ]
    : [];

  return [
    `Buenos días! Hoy ${dayName} ${dayNum} de ${monthName} se juegan los siguientes partidos:`,
    ...lines,
    ...trasnochadoLines,
    "",
    "No te olvides que tenés hasta 1 hora antes de cada partido para hacer tu predicción!",
  ].join("\n");
}

export function formatPreMatchMessage(matches: Match[]): string {
  const lines = matches.map((m) => `⚽ ${m.home} vs ${m.away}`);
  return `En 90 minutos juegan:\n${lines.join("\n")}`;
}

export function formatPayload(channel: NotificationChannel, message: string): object {
  switch (channel) {
    case "google_chat":
      return { text: message };
    case "slack":
      return { text: message };
    case "teams":
      return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        text: message,
      };
  }
}

export async function sendNotification(
  webhookUrl: string,
  channel: NotificationChannel,
  message: string
): Promise<void> {
  const payload = formatPayload(channel, message);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Webhook POST failed: ${res.status} ${res.statusText}`);
  }
}

export async function getEnabledCompanies(
  type: "morningMessage" | "preMatchReminder"
): Promise<Array<{
  id: string;
  channel: NotificationChannel;
  webhookUrl: string;
  sentReminders: Record<string, string>;
}>> {
  const snap = await adminDb.collection("companies").get();
  const results: Array<{
    id: string;
    channel: NotificationChannel;
    webhookUrl: string;
    sentReminders: Record<string, string>;
  }> = [];

  const nowART = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const currentHourART = nowART.getHours();

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.plan !== "premium") continue;
    const n = data.notifications;
    if (!n?.webhookUrl || !n?.channel) continue;
    if (!n?.[type]) continue;

    if (type === "morningMessage") {
      const configuredHour = typeof n.morningMessageHour === "number" ? n.morningMessageHour : 11;
      if (currentHourART !== configuredHour) continue;
      const todayStr = todayART();
      if (n.morningMessageSentDate === todayStr) continue;
    }

    results.push({
      id: docSnap.id,
      channel: n.channel as NotificationChannel,
      webhookUrl: n.webhookUrl,
      sentReminders: n.sentReminders ?? {},
    });
  }
  return results;
}

export function getUpcomingMatchGroups(todayMatches: Match[]): Match[][] {
  const now = Date.now();
  const inWindow = todayMatches.filter((m) => {
    const ko = kickoffUTC(m.date, m.time);
    const diff = ko - now;
    return diff >= 80 * 60_000 && diff <= 95 * 60_000;
  });

  const groups = new Map<number, Match[]>();
  for (const m of inWindow) {
    const ko = kickoffUTC(m.date, m.time);
    const existing = groups.get(ko) ?? [];
    existing.push(m);
    groups.set(ko, existing);
  }
  return Array.from(groups.values());
}

export function todayART(): string {
  const now = new Date();
  const artDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const y = artDate.getFullYear();
  const m = String(artDate.getMonth() + 1).padStart(2, "0");
  const d = String(artDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
