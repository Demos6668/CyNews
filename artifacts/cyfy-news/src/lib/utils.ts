import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

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
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-destructive/10 text-destructive border-destructive/20 shadow-[inset_4px_0_0_0_hsl(var(--destructive))]';
    case 'high':
      return 'bg-accent/10 text-accent border-accent/20 shadow-[inset_4px_0_0_0_hsl(var(--accent))]';
    case 'medium':
      return 'bg-warning/10 text-warning border-warning/20 shadow-[inset_4px_0_0_0_hsl(var(--warning))]';
    case 'low':
      return 'bg-success/10 text-success border-success/20 shadow-[inset_4px_0_0_0_hsl(var(--success))]';
    case 'info':
    default:
      return 'bg-primary/10 text-primary border-primary/20 shadow-[inset_4px_0_0_0_hsl(var(--primary))]';
  }
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
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-destructive/20 text-destructive border-destructive/30';
    case 'high':
      return 'bg-accent/20 text-accent border-accent/30';
    case 'medium':
      return 'bg-warning/20 text-warning border-warning/30';
    case 'low':
      return 'bg-success/20 text-success border-success/30';
    case 'info':
    default:
      return 'bg-primary/20 text-primary border-primary/30';
  }
}
