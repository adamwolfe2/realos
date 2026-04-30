// Minimal RFC 5545 iCalendar (.ics) generator. We avoid the `ics` npm
// package because:
//   1. Our needs are tiny (a single VEVENT per tour)
//   2. Vercel cold start time matters; one less dep helps
//   3. RFC 5545 line-folding is straightforward to implement.

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  url?: string;
};

function formatDateUTC(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// RFC 5545 says lines must not exceed 75 octets; CRLF + space continues.
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const slice = line.slice(i, i + 75);
    out.push(i === 0 ? slice : ` ${slice}`);
    i += 75;
  }
  return out.join("\r\n");
}

export function buildIcs(events: IcsEvent[], prodId = "LeaseStack"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${prodId}//Tours//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const now = formatDateUTC(new Date());

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${formatDateUTC(ev.start)}`);
    lines.push(`DTEND:${formatDateUTC(ev.end)}`);
    lines.push(`SUMMARY:${escape(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escape(ev.location)}`);
    if (ev.url) lines.push(`URL:${escape(ev.url)}`);
    if (ev.organizerEmail) {
      lines.push(
        `ORGANIZER${ev.organizerName ? `;CN=${escape(ev.organizerName)}` : ""}:mailto:${ev.organizerEmail}`,
      );
    }
    if (ev.attendeeEmail) {
      lines.push(
        `ATTENDEE${ev.attendeeName ? `;CN=${escape(ev.attendeeName)}` : ""};RSVP=TRUE:mailto:${ev.attendeeEmail}`,
      );
    }
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Fold long lines + use CRLF as the spec requires.
  return lines.map(fold).join("\r\n") + "\r\n";
}
