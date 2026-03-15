/**
 * India Detector - Robust detection of India-related content for scope classification.
 * LOCAL = India-specific content only; GLOBAL = everything else.
 */

export interface IndiaDetectionResult {
  isIndia: boolean;
  confidence: number;
  matches: Array<{ type: string; value: string; weight: number }>;
  scope: "local" | "global";
}

export interface StateDetection {
  state: string;
  code: string;
  city?: string;
}

export interface IndiaDetails {
  isIndia: boolean;
  confidence: number;
  state: string | null;
  stateName: string | null;
  city: string | null;
  sector: string | null;
  matches: Array<{ type: string; value: string; weight: number }>;
}

// Full state/UT names only - exclude 2-letter codes to avoid false positives (e.g. "as", "up", "uk" match common words)
const INDIAN_STATES = [
  "andhra pradesh",
  "arunachal pradesh",
  "assam",
  "bihar",
  "chhattisgarh",
  "goa",
  "gujarat",
  "haryana",
  "himachal pradesh",
  "jharkhand",
  "karnataka",
  "kerala",
  "madhya pradesh",
  "maharashtra",
  "manipur",
  "meghalaya",
  "mizoram",
  "nagaland",
  "odisha",
  "punjab",
  "rajasthan",
  "sikkim",
  "tamil nadu",
  "telangana",
  "tripura",
  "uttar pradesh",
  "uttarakhand",
  "west bengal",
  "andaman and nicobar",
  "chandigarh",
  "dadra and nagar haveli",
  "daman and diu",
  "delhi",
  "jammu and kashmir",
  "ladakh",
  "lakshadweep",
  "puducherry",
];

const INDIAN_CITIES = [
  "mumbai",
  "delhi",
  "bangalore",
  "bengaluru",
  "hyderabad",
  "chennai",
  "kolkata",
  "pune",
  "ahmedabad",
  "jaipur",
  "lucknow",
  "kanpur",
  "nagpur",
  "indore",
  "thane",
  "bhopal",
  "visakhapatnam",
  "vizag",
  "patna",
  "vadodara",
  "ghaziabad",
  "ludhiana",
  "agra",
  "nashik",
  "faridabad",
  "meerut",
  "rajkot",
  "varanasi",
  "srinagar",
  "aurangabad",
  "dhanbad",
  "amritsar",
  "navi mumbai",
  "allahabad",
  "prayagraj",
  "ranchi",
  "howrah",
  "coimbatore",
  "jabalpur",
  "gwalior",
  "vijayawada",
  "jodhpur",
  "madurai",
  "raipur",
  "kochi",
  "cochin",
  "chandigarh",
  "thiruvananthapuram",
  "trivandrum",
  "gurgaon",
  "gurugram",
  "noida",
  "greater noida",
  "mysore",
  "mysuru",
  "tiruchirappalli",
  "trichy",
  "bhubaneswar",
  "salem",
  "warangal",
  "guntur",
  "bhiwandi",
  "saharanpur",
  "gorakhpur",
  "bikaner",
  "amravati",
  "jamshedpur",
  "bhilai",
  "cuttack",
  "firozabad",
  "kota",
  "dehradun",
  "bareilly",
  "moradabad",
  "tiruppur",
  "mangalore",
  "mangaluru",
  "bokaro",
  "nellore",
  "belgaum",
  "belagavi",
];

const INDIAN_AGENCIES = [
  "cert-in",
  "certin",
  "cert in",
  "indian cert",
  "nciipc",
  "national critical information infrastructure protection centre",
  "meity",
  "ministry of electronics",
  "ministry of it",
  "i4c",
  "indian cyber crime coordination centre",
  "npcil",
  "nuclear power corporation of india",
  "drdo",
  "defence research",
  "isro",
  "indian space",
  "rbi",
  "reserve bank of india",
  "reserve bank",
  "sebi",
  "securities and exchange board of india",
  "irdai",
  "insurance regulatory",
  "pfrda",
  "pension fund regulatory",
  "npci",
  "national payments corporation",
  "upi",
  "uidai",
  "unique identification authority",
  "aadhaar",
  "central government",
  "indian government",
  "govt of india",
  "goi",
  "ministry of home affairs",
  "mha",
  "ministry of defence",
  "mod",
  "ministry of finance",
  "ministry of external affairs",
  "mea",
  "cbi",
  "central bureau",
  "nia",
  "national investigation agency",
  "intelligence bureau",
  "research and analysis wing",
  "bsf",
  "border security force",
  "crpf",
  "cisf",
  "itbp",
  "ssb",
  "indian army",
  "indian navy",
  "indian air force",
  "iaf",
  "indian police",
  "delhi police",
  "mumbai police",
  "cyber cell",
  "niti aayog",
  "planning commission",
  "election commission of india",
  "cag",
  "comptroller and auditor general",
  "upsc",
  "ssc",
  "parliament of india",
  "lok sabha",
  "rajya sabha",
  "supreme court of india",
  "high court",
  "district court",
  "sessions court",
];

const INDIAN_COMPANIES = [
  "tcs",
  "tata consultancy",
  "infosys",
  "wipro",
  "hcl",
  "tech mahindra",
  "cognizant india",
  "mindtree",
  "mphasis",
  "ltimindtree",
  "persistent",
  "zensar",
  "hexaware",
  "cyient",
  "niit",
  "zoho",
  "freshworks",
  "razorpay",
  "paytm",
  "phonepe",
  "mobikwik",
  "cred",
  "groww",
  "zerodha",
  "upstox",
  "angel broking",
  "angel one",
  "5paisa",
  "byju",
  "unacademy",
  "vedantu",
  "ola",
  "uber india",
  "swiggy",
  "zomato",
  "flipkart",
  "myntra",
  "meesho",
  "nykaa",
  "bigbasket",
  "blinkit",
  "dream11",
  "jio",
  "reliance digital",
  "airtel",
  "vodafone india",
  "bsnl",
  "mtnl",
  "idea cellular",
  "sbi",
  "state bank of india",
  "hdfc bank",
  "hdfc",
  "icici bank",
  "icici",
  "axis bank",
  "kotak mahindra",
  "kotak bank",
  "yes bank",
  "indusind",
  "punjab national bank",
  "pnb",
  "bank of baroda",
  "bob",
  "canara bank",
  "union bank",
  "bank of india",
  "boi",
  "central bank",
  "idbi bank",
  "indian bank",
  "iob",
  "indian overseas bank",
  "lic",
  "life insurance corporation",
  "gic",
  "general insurance",
  "tata group",
  "tata sons",
  "tata motors",
  "tata steel",
  "tata power",
  "reliance industries",
  "ril",
  "reliance jio",
  "reliance retail",
  "adani",
  "adani group",
  "adani ports",
  "adani power",
  "adani green",
  "mahindra",
  "mahindra & mahindra",
  "m&m",
  "birla",
  "aditya birla",
  "godrej",
  "bajaj",
  "bajaj auto",
  "hero",
  "hero motocorp",
  "tvs",
  "larsen & toubro",
  "l&t",
  "bharat heavy electricals",
  "bhel",
  "ntpc",
  "ongc",
  "ioc",
  "indian oil",
  "bpcl",
  "hpcl",
  "gail",
  "coal india",
  "sail",
  "nse",
  "national stock exchange",
  "bse",
  "bombay stock exchange",
  "sensex",
  "nifty",
  "nifty50",
  "indian railways",
  "irctc",
  "air india",
  "indigo airlines",
  "spicejet",
  "go air",
  "vistara",
  "akasa",
];

const INDIAN_FINTECH = [
  "upi",
  "unified payments interface",
  "bhim",
  "bhim app",
  "imps",
  "neft",
  "rtgs",
  "nach",
  "ecs",
  "aeps",
  "rupay",
  "rupay card",
  "national common mobility card",
  "ncmc",
  "fastag",
  "netc",
  "bbps",
  "bharat bill payment",
  "digilocker",
  "umang",
  "aarogya setu",
  "cowin",
  "co-win",
  "gstn",
  "gst network",
  "gstin",
  "pan card",
  "tan",
  "epfo",
  "pf",
  "provident fund",
  "esic",
  "esi",
  "pm kisan",
  "jan dhan",
  "mudra",
  "stand up india",
  "digital india",
  "make in india",
  "startup india",
  "skill india",
];

const INDIAN_CYBER_TERMS = [
  "indian hacker",
  "indian cyber",
  "cyber attack india",
  "india breach",
  "india data leak",
  "indian citizen",
  "indian user",
  "indian customer",
  "lakh",
  "crore",
  "lakhs",
  "crores",
  "rupee",
  "rupees",
  "rs.",
  "inr",
  "indian database",
  "india server",
  "mumbai data center",
  "indian id",
  "pan number",
  "aadhaar number",
  "voter id india",
  "indian passport",
  "indian driving license",
];

const INDIA_SOURCE_KEYWORDS = [
  "cert-in",
  "certin",
  "nciipc",
  "dsci",
  "npci",
  "rbi",
  "sebi",
  "meity",
  "medianama",
  "inc42",
  "yourstory",
  "indian",
  "the hindu",
  "economic times",
  "times of india",
  "hindustan times",
  "ndtv",
  "india today",
  "business standard",
  "mint",
  "livemint",
  "moneycontrol",
  "zee news",
  "republic",
  "firstpost",
  "news18",
  "aaj tak",
];

const STATE_MAP: Record<string, string> = {
  maharashtra: "MH",
  karnataka: "KA",
  "tamil nadu": "TN",
  telangana: "TG",
  "andhra pradesh": "AP",
  kerala: "KL",
  gujarat: "GJ",
  rajasthan: "RJ",
  "uttar pradesh": "UP",
  "west bengal": "WB",
  "madhya pradesh": "MP",
  punjab: "PB",
  haryana: "HR",
  delhi: "DL",
  bihar: "BR",
  odisha: "OD",
  jharkhand: "JH",
  chhattisgarh: "CG",
  assam: "AS",
  uttarakhand: "UK",
  "himachal pradesh": "HP",
  goa: "GA",
  "jammu and kashmir": "JK",
  chandigarh: "CH",
};

const CITY_TO_STATE: Record<string, string> = {
  mumbai: "MH",
  pune: "MH",
  nagpur: "MH",
  nashik: "MH",
  thane: "MH",
  bangalore: "KA",
  bengaluru: "KA",
  mysore: "KA",
  mangalore: "KA",
  chennai: "TN",
  coimbatore: "TN",
  madurai: "TN",
  salem: "TN",
  hyderabad: "TG",
  secunderabad: "TG",
  warangal: "TG",
  delhi: "DL",
  "new delhi": "DL",
  noida: "UP",
  gurgaon: "HR",
  gurugram: "HR",
  kolkata: "WB",
  howrah: "WB",
  siliguri: "WB",
  ahmedabad: "GJ",
  surat: "GJ",
  vadodara: "GJ",
  rajkot: "GJ",
  jaipur: "RJ",
  jodhpur: "RJ",
  udaipur: "RJ",
  lucknow: "UP",
  kanpur: "UP",
  agra: "UP",
  varanasi: "UP",
  bhopal: "MP",
  indore: "MP",
  jabalpur: "MP",
  patna: "BR",
  ranchi: "JH",
  bhubaneswar: "OD",
  kochi: "KL",
  cochin: "KL",
  trivandrum: "KL",
  thiruvananthapuram: "KL",
  chandigarh: "CH",
  ludhiana: "PB",
  amritsar: "PB",
  dehradun: "UK",
  shimla: "HP",
  srinagar: "JK",
  jammu: "JK",
};

const SECTOR_KEYWORDS: Record<string, string[]> = {
  "Banking & Financial Services": [
    "bank",
    "rbi",
    "sebi",
    "loan",
    "credit",
    "debit",
    "finance",
    "mutual fund",
    "insurance",
    "lic",
    "trading",
    "stock",
    "nse",
    "bse",
  ],
  "Government & PSU": [
    "government",
    "ministry",
    "psu",
    "public sector",
    "sarkari",
    "nic.in",
    "gov.in",
    "parliament",
    "election",
  ],
  "IT & ITES": [
    "tcs",
    "infosys",
    "wipro",
    "hcl",
    "tech mahindra",
    "software",
    "it company",
    "it sector",
    "bpo",
    "kpo",
  ],
  Healthcare: [
    "hospital",
    "medical",
    "pharma",
    "health",
    "doctor",
    "patient",
    "aiims",
    "icmr",
    "ayush",
  ],
  Telecom: [
    "airtel",
    "jio",
    "vodafone",
    "bsnl",
    "telecom",
    "5g",
    "4g",
    "mobile network",
    "isp",
  ],
  Defence: [
    "army",
    "navy",
    "air force",
    "drdo",
    "isro",
    "defence",
    "military",
    "hal",
    "bdl",
    "bel",
  ],
  "Energy & Power": [
    "power grid",
    "ntpc",
    "ongc",
    "iocl",
    "bpcl",
    "hpcl",
    "coal india",
    "energy",
    "electricity",
    "oil",
    "gas",
  ],
  "E-commerce & Retail": [
    "flipkart",
    "amazon india",
    "myntra",
    "swiggy",
    "zomato",
    "ecommerce",
    "online shopping",
  ],
  Education: [
    "university",
    "iit",
    "iim",
    "nit",
    "college",
    "school",
    "ugc",
    "aicte",
    "cbse",
    "icse",
  ],
  "Transport & Logistics": [
    "railways",
    "irctc",
    "airport",
    "port",
    "shipping",
    "logistics",
    "road transport",
    "nhai",
  ],
};

const PATTERNS = {
  aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  pan: /\b[A-Z]{5}\d{4}[A-Z]\b/,
  indianPhone: /\b(\+91|91|0)?[6-9]\d{9}\b/,
  pincode: /\b[1-9]\d{5}\b/,
  inDomain: /\.[a-z]+\.in\b|\.in\b/,
  gstNumber: /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/,
};

const INDIA_THRESHOLD = 20;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class IndiaDetector {
  private readonly allKeywords: string[];
  private readonly keywordSet: Set<string>;

  constructor() {
    this.allKeywords = [
      "india",
      "indian",
      "bharat",
      "hindustan",
      ...INDIAN_STATES,
      ...INDIAN_CITIES,
      ...INDIAN_AGENCIES,
      ...INDIAN_COMPANIES,
      ...INDIAN_FINTECH,
      ...INDIAN_CYBER_TERMS,
    ];
    this.keywordSet = new Set(this.allKeywords.map((k) => k.toLowerCase()));
  }

  isIndiaRelated(text: string, metadata?: { country?: string; source?: string }): IndiaDetectionResult {
    if (!text) return { isIndia: false, confidence: 0, matches: [], scope: "global" };

    const lowerText = text.toLowerCase();
    const matches: Array<{ type: string; value: string; weight: number }> = [];
    let confidence = 0;

    for (const keyword of this.allKeywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerKeyword.length <= 3) {
        const regex = new RegExp(`\\b${escapeRegex(lowerKeyword)}\\b`, "i");
        if (regex.test(lowerText)) {
          matches.push({ type: "keyword", value: keyword, weight: 10 });
          confidence += 10;
        }
      } else {
        if (lowerText.includes(lowerKeyword)) {
          matches.push({ type: "keyword", value: keyword, weight: 15 });
          confidence += 15;
        }
      }
    }

    if (PATTERNS.aadhaar.test(text)) {
      matches.push({ type: "pattern", value: "Aadhaar number", weight: 30 });
      confidence += 30;
    }
    if (PATTERNS.pan.test(text)) {
      matches.push({ type: "pattern", value: "PAN number", weight: 30 });
      confidence += 30;
    }
    if (PATTERNS.indianPhone.test(text)) {
      matches.push({ type: "pattern", value: "Indian phone", weight: 20 });
      confidence += 20;
    }
    if (PATTERNS.inDomain.test(lowerText)) {
      matches.push({ type: "pattern", value: ".in domain", weight: 25 });
      confidence += 25;
    }
    if (PATTERNS.gstNumber.test(text)) {
      matches.push({ type: "pattern", value: "GST number", weight: 30 });
      confidence += 30;
    }

    if (metadata?.country) {
      const country = metadata.country.toLowerCase();
      if (country === "india" || country === "in" || country === "ind") {
        matches.push({ type: "metadata", value: "country=India", weight: 50 });
        confidence += 50;
      }
    }

    if (metadata?.source) {
      for (const kw of INDIA_SOURCE_KEYWORDS) {
        if (metadata.source.toLowerCase().includes(kw)) {
          matches.push({ type: "source", value: metadata.source, weight: 40 });
          confidence += 40;
          break;
        }
      }
    }

    confidence = Math.min(confidence, 100);
    const isIndia = confidence >= INDIA_THRESHOLD;

    return {
      isIndia,
      confidence,
      matches: matches.slice(0, 10),
      scope: isIndia ? "local" : "global",
    };
  }

  detectState(text: string): StateDetection | null {
    if (!text) return null;
    const lowerText = text.toLowerCase();

    for (const [state, code] of Object.entries(STATE_MAP)) {
      if (lowerText.includes(state)) {
        return { state, code };
      }
    }

    for (const [city, code] of Object.entries(CITY_TO_STATE)) {
      if (lowerText.includes(city)) {
        const stateName = Object.keys(STATE_MAP).find((s) => STATE_MAP[s] === code);
        return { state: stateName ?? code, code, city };
      }
    }

    return null;
  }

  detectSector(text: string): string | null {
    if (!text) return null;
    const lowerText = text.toLowerCase();

    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) return sector;
      }
    }
    return null;
  }

  isIndianSource(sourceName: string): boolean {
    const lower = sourceName.toLowerCase();
    return INDIA_SOURCE_KEYWORDS.some((kw) => lower.includes(kw));
  }

  getIndiaDetails(text: string, metadata?: { country?: string; source?: string }): IndiaDetails {
    const detection = this.isIndiaRelated(text, metadata);
    const state = this.detectState(text);
    const sector = this.detectSector(text);

    return {
      isIndia: detection.isIndia,
      confidence: detection.confidence,
      state: state?.code ?? null,
      stateName: state?.state ?? null,
      city: state?.city ?? null,
      sector: sector ?? null,
      matches: detection.matches,
    };
  }
}

export const indiaDetector = new IndiaDetector();
