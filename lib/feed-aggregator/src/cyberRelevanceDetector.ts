/**
 * CyberSecurityRelevanceDetector - Filters non-cybersecurity content from feeds.
 * Used to prevent general news (cricket, movies, weather, etc.) from appearing in security feeds.
 * Mirrors lib/cyber-relevance-detector for workspace compatibility when pnpm is not available.
 */

export interface RelevanceResult {
  isRelevant: boolean;
  confidence: number;
  category: string | null;
  matches?: Array<{ type: string; value: string }>;
  reason?: string;
}

const STRONG_CYBER_KEYWORDS = [
  "ransomware", "malware", "phishing", "spearphishing", "whaling", "ddos", "denial of service",
  "brute force", "credential stuffing", "sql injection", "xss", "cross-site scripting", "csrf",
  "rce", "remote code execution", "privilege escalation", "buffer overflow", "zero-day", "zero day",
  "0-day", "exploit", "payload", "backdoor", "rootkit", "keylogger", "trojan", "worm", "virus",
  "botnet", "apt", "advanced persistent threat", "supply chain attack", "man-in-the-middle", "mitm",
  "session hijacking", "clickjacking", "vulnerability", "cve-", "cwe-", "cvss", "patch", "security update",
  "security advisory", "security bulletin", "security flaw", "security hole", "security bug", "unpatched",
  "exploit kit", "data breach", "data leak", "data exposure", "credential leak", "password leak",
  "database leak", "compromised", "breached", "hacked", "cyber attack", "cyberattack", "security incident",
  "security breach", "unauthorized access", "intrusion", "threat actor", "hacker", "hackers", "hacking",
  "cybercriminal", "cyber criminal", "nation-state", "state-sponsored", "hacktivist", "ransomware gang",
  "ransomware group", "apt group", "threat group", "firewall", "antivirus", "anti-malware", "endpoint protection",
  "siem", "soar", "ids", "ips", "intrusion detection", "penetration test", "pentest", "red team", "blue team",
  "vulnerability scan", "security audit", "threat intelligence", "ioc", "indicator of compromise", "ttps",
  "mitre att&ck", "authentication bypass", "mfa bypass", "2fa bypass", "credential theft", "identity theft",
  "account takeover", "encryption", "decryption", "cryptographic", "ssl", "tls", "certificate", "private key",
  "public key", "network security", "vpn", "proxy", "tor", "dark web", "command and control", "c2", "c&c",
  "exfiltration", "lateral movement", "network intrusion", "cloud security", "aws security", "azure security",
  "gcp security", "kubernetes security", "container security", "docker security", "misconfiguration",
  "s3 bucket", "exposed database", "pci dss", "hipaa", "gdpr", "iso 27001", "nist", "security compliance",
  "data protection", "ics security", "scada", "ot security", "industrial control", "iot security",
  "smart device", "embedded security", "cert-in", "cisa", "us-cert", "ncsc", "cert", "advisory",
  "security notice", "security warning", "threat alert",
];

const IT_TECH_KEYWORDS = [
  "software", "hardware", "server", "database", "api", "sdk", "application", "platform", "cloud",
  "saas", "paas", "iaas", "devops", "deployment", "infrastructure", "network", "windows", "linux",
  "macos", "android", "ios", "mobile app", "web application", "browser", "chrome", "firefox", "edge",
  "safari", "java", "python", "javascript", "php", "docker", "kubernetes", "terraform", "ansible",
  "microsoft", "google", "apple", "amazon", "meta", "facebook", "oracle", "cisco", "vmware", "citrix",
  "fortinet", "palo alto", "crowdstrike", "sophos", "kaspersky", "mcafee", "symantec", "adobe",
  "salesforce", "sap", "atlassian", "gitlab", "github", "data privacy", "personal data", "pii",
  "sensitive data", "data governance", "data security", "information security", "source code",
  "repository", "git", "version control", "code review", "secure coding", "devsecops",
];

const NON_RELEVANT_PATTERNS: RegExp[] = [
  /\b(?:cricket|football|soccer|basketball|tennis|golf|hockey|baseball)\s+(?:match|game|score|player|team|league)\b/i,
  /\b(?:movie|film|bollywood|hollywood|actor|actress|celebrity|entertainment)\b/i,
  /\b(?:music|album|song|singer|concert|festival)\b/i,
  /\bipl\s+(?:match|score|team|player)\b/i,
  /\b(?:election|vote|parliament|minister|political|politics)\b(?!.*(?:cyber|hack|breach|security))/i,
  /\b(?:rally|campaign|manifesto|constituency)\b/i,
  /\b(?:weather|forecast|temperature|rainfall)\b/i,
  /\b(?:stock\s+market|share\s+price|sensex|nifty)(?!.*(?:hack|breach|cyber|fraud))\b/i,
  /\b(?:real\s+estate|property|apartment|housing)\b/i,
  /\b(?:restaurant|food|recipe|cooking|cuisine)\b/i,
  /\b(?:travel|tourism|vacation|holiday|hotel)\b/i,
  /\b(?:fashion|clothing|style|trend|designer)\b/i,
  /\b(?:covid|coronavirus|pandemic|vaccine|hospital|doctor|patient|treatment|disease|symptom)(?!.*(?:cyber|hack|breach|data|phishing))\b/i,
  /\b(?:loan|mortgage|interest\s+rate|emi|savings|investment)(?!.*(?:cyber|hack|breach|fraud|phishing|scam))\b/i,
  /\b(?:exam|admission|result|school|college|university)(?!.*(?:cyber|hack|breach|data\s+leak))\b/i,
  /\b(?:farming|agriculture|crop|harvest|monsoon|wildlife)\b/i,
  /\b(?:flight|train|bus|metro|traffic)(?!.*(?:cyber|hack|system|breach|booking\s+fraud))\b/i,
];

const CYBER_CONTEXT_PHRASES = [
  "security researcher", "security team", "security expert", "threat researcher", "malware analyst",
  "incident response", "bug bounty", "responsible disclosure", "proof of concept", "security community",
  "infosec", "cybersecurity",
];

const SECURITY_SOURCES = [
  "cert-in", "cisa", "ncsc", "bleepingcomputer", "thehackernews", "darkreading", "securityweek",
  "threatpost", "krebs", "securityaffairs", "talos", "unit42", "mandiant", "crowdstrike", "sentinelone",
  "kaspersky", "eset", "checkpoint", "fortinet", "sophos",
];

const CVE_PATTERN = /CVE-\d{4}-\d{4,}/i;
const RELEVANCE_THRESHOLD = 25;

export class CyberSecurityRelevanceDetector {
  isRelevant(text: string, metadata?: { source?: string }): RelevanceResult {
    if (!text || typeof text !== "string") {
      return { isRelevant: false, confidence: 0, category: null };
    }

    const lowerText = text.toLowerCase();
    let relevanceScore = 0;
    let category: string | null = null;
    const matches: Array<{ type: string; value: string }> = [];

    // Step 1: Check non-relevant content first
    for (const pattern of NON_RELEVANT_PATTERNS) {
      if (pattern.test(lowerText)) {
        const hasCyberContent = STRONG_CYBER_KEYWORDS.some((kw) => lowerText.includes(kw.toLowerCase()));
        if (!hasCyberContent) {
          return {
            isRelevant: false,
            confidence: 0,
            category: null,
            reason: "Non-cybersecurity content detected",
          };
        }
      }
    }

    // Step 2: Strong cyber keywords
    for (const keyword of STRONG_CYBER_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        relevanceScore += 30;
        matches.push({ type: "strong_cyber", value: keyword });
      }
    }

    // Step 3: IT/Tech keywords
    for (const keyword of IT_TECH_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        relevanceScore += 10;
        matches.push({ type: "it_tech", value: keyword });
      }
    }

    // Step 4: Cyber context phrases
    for (const phrase of CYBER_CONTEXT_PHRASES) {
      if (lowerText.includes(phrase.toLowerCase())) {
        relevanceScore += 20;
        matches.push({ type: "context", value: phrase });
      }
    }

    // Step 5: CVE pattern
    if (CVE_PATTERN.test(text)) {
      relevanceScore += 50;
      matches.push({ type: "cve", value: "CVE pattern detected" });
    }

    // Step 6: Metadata source
    if (metadata?.source) {
      const isSecuritySource = SECURITY_SOURCES.some((src) => metadata.source!.toLowerCase().includes(src));
      if (isSecuritySource) {
        relevanceScore += 40;
        matches.push({ type: "source", value: metadata.source });
      }
    }

    relevanceScore = Math.min(relevanceScore, 100);
    const isRelevant = relevanceScore >= RELEVANCE_THRESHOLD;

    return {
      isRelevant,
      confidence: relevanceScore,
      category: category ?? "Security",
      matches: matches.slice(0, 10),
      reason: !isRelevant ? "low confidence" : undefined,
    };
  }
}

export const cyberRelevanceDetector = new CyberSecurityRelevanceDetector();
