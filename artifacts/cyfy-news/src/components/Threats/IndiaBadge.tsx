const STATE_NAMES: Record<string, string> = {
  MH: "Maharashtra",
  KA: "Karnataka",
  TN: "Tamil Nadu",
  TG: "Telangana",
  AP: "Andhra Pradesh",
  KL: "Kerala",
  GJ: "Gujarat",
  RJ: "Rajasthan",
  UP: "Uttar Pradesh",
  WB: "West Bengal",
  DL: "Delhi",
  HR: "Haryana",
  PB: "Punjab",
  MP: "Madhya Pradesh",
  BR: "Bihar",
  JH: "Jharkhand",
  OD: "Odisha",
  CG: "Chhattisgarh",
  AS: "Assam",
  UK: "Uttarakhand",
  HP: "Himachal Pradesh",
  JK: "J&K",
  GA: "Goa",
  CH: "Chandigarh",
};

interface IndiaItem {
  scope?: string | null;
  isIndiaRelated?: boolean | null;
  indianState?: string | null;
  indianStateName?: string | null;
  indianCity?: string | null;
  indianSector?: string | null;
}

interface IndiaBadgeProps {
  item: IndiaItem;
}

export function IndiaBadge({ item }: IndiaBadgeProps) {
  if (!item.isIndiaRelated && item.scope !== "local") return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full border border-orange-500/30">
        India
      </span>
      {item.indianState && (
        <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
          {STATE_NAMES[item.indianState] ?? item.indianState}
        </span>
      )}
      {item.indianCity && (
        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
          {item.indianCity}
        </span>
      )}
      {item.indianSector && (
        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
          {item.indianSector}
        </span>
      )}
    </div>
  );
}
