type LeadIdentity = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

const ROLE_MAILBOXES = new Set([
  "admin",
  "admissions",
  "apply",
  "applications",
  "contact",
  "hello",
  "info",
  "leasing",
  "office",
  "rentals",
  "support",
  "team",
]);

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-US"));
}

function emailDisplayName(email: string): string | null {
  const localPart = email.split("@", 1)[0]?.trim().toLocaleLowerCase("en-US");
  if (!localPart) return null;

  const words = localPart
    .split(/[._-]+/)
    .map((word) => word.replace(/^\d+|\d+$/g, ""))
    .filter(Boolean);
  if (words.length === 0 || words.some((word) => !/^\p{L}+$/u.test(word))) {
    return null;
  }
  if (words.length === 1 && ROLE_MAILBOXES.has(words[0])) return null;

  return titleCase(words.join(" "));
}

export function leadDisplayName(identity: LeadIdentity): string {
  const storedName = [identity.firstName, identity.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (storedName) return storedName;

  const email = identity.email?.trim() ?? "";
  if (!email) return "Unidentified lead";

  return emailDisplayName(email) ?? email;
}
