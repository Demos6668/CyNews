import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { getSeverityToken } from "@/lib/design-tokens";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), "MMM d, yyyy HH:mm");
  } catch (e) {
    return dateString;
  }
}

export function formatRelative(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (e) {
    return dateString;
  }
}

export function getSeverityColors(severity: string) {
  const t = getSeverityToken(severity);
  // Keep the inset shadow pattern — uses raw CSS variable for the color channel
  const varName = t.fg.replace("text-", ""); // e.g. "destructive", "accent"
  return `${t.bg.replace("/15", "/10")} ${t.fg} ${t.border.replace("/30", "/20")} shadow-[inset_4px_0_0_0_hsl(var(--${varName}))]`;
}

/** Strip HTML tags and decode common entities to plain text. */
export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function getSeverityBadgeColors(severity: string) {
  const t = getSeverityToken(severity);
  return `${t.bg} ${t.fg} ${t.border}`;
}
