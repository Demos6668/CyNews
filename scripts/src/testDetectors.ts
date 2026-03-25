/**
 * Test India Detector and CyberSecurity Relevance Detector.
 * Run: pnpm --filter @workspace/scripts run test-detectors
 */

import { indiaDetector } from "@workspace/india-detector";
import { cyberRelevanceDetector } from "@workspace/feed-aggregator";

console.log("=== INDIA DETECTOR TESTS ===\n");

const indiaTests: Array<{ text: string; expected: boolean }> = [
  { text: "CERT-In issues advisory on Microsoft vulnerabilities", expected: true },
  { text: "Data breach exposes 10 lakh Indian users", expected: true },
  { text: "SBI faces ransomware attack, 5 crore records at risk", expected: true },
  { text: "Hackers target Mumbai-based fintech startup", expected: true },
  { text: "Infosys reports security incident affecting clients", expected: true },
  { text: "RBI warns banks about new UPI fraud", expected: true },
  { text: "Cyberattack on Delhi Metro smart card system", expected: true },
  { text: "Aadhaar data leaked on dark web forum", expected: true },
  { text: "Bangalore-based cybersecurity firm discovers new malware", expected: true },
  { text: "Indian government portal hacked, citizen data exposed", expected: true },
  { text: "Indiana University suffers data breach", expected: false },
  { text: "Indianapolis-based company reports cyberattack", expected: false },
  { text: "Microsoft releases Patch Tuesday updates", expected: false },
  { text: "New ransomware strain targets US hospitals", expected: false },
  { text: "CISA warns about critical Cisco vulnerability", expected: false },
  { text: "Chinese hackers target US defense contractors", expected: false },
  { text: "European banks face phishing campaign", expected: false },
  { text: "Fort Wayne, Indiana school district hit by ransomware", expected: false },
  { text: "Purdue University research on cybersecurity", expected: false },
  { text: "Notre Dame develops new encryption method", expected: false },
  { text: "West Indies cricket team website hacked", expected: false },
  { text: "American Indian casino data breach", expected: false },
];

let passed = 0;
let failed = 0;

for (const test of indiaTests) {
  const result = indiaDetector.isIndiaRelated(test.text);
  const status = result.isIndia === test.expected ? "PASS" : "FAIL";
  if (result.isIndia === test.expected) passed++;
  else failed++;

  console.log(`${status} "${test.text.substring(0, 50)}..."`);
  console.log(`   Expected: ${test.expected ? "LOCAL" : "GLOBAL"}, Got: ${result.isIndia ? "LOCAL" : "GLOBAL"}`);
  if (result.isIndia !== test.expected) {
    console.log(`   Reason: ${result.reason ?? "N/A"}, Confidence: ${result.confidence}`);
  }
  console.log();
}

console.log(`\nIndia Results: ${passed} passed, ${failed} failed\n`);

console.log("=== CYBERSECURITY RELEVANCE TESTS ===\n");

const relevanceTests: Array<{ text: string; expected: boolean }> = [
  { text: "New ransomware strain encrypts hospital systems", expected: true },
  { text: "CVE-2024-1234 allows remote code execution", expected: true },
  { text: "Phishing campaign targets bank customers", expected: true },
  { text: "Critical vulnerability in Apache server", expected: true },
  { text: "Data breach exposes 1 million user records", expected: true },
  { text: "Hackers exploit zero-day in Chrome browser", expected: true },
  { text: "CISA issues emergency directive on Citrix flaw", expected: true },
  { text: "APT group targets defense contractors", expected: true },
  { text: "India vs Pakistan cricket match highlights", expected: false },
  { text: "New Bollywood movie breaks box office records", expected: false },
  { text: "Weather forecast: Heavy rainfall expected", expected: false },
  { text: "Stock market closes at all-time high", expected: false },
  { text: "Election results declared for state assembly", expected: false },
  { text: "New restaurant opens in downtown area", expected: false },
  { text: "Celebrity couple announces engagement", expected: false },
  { text: "Traffic diverted due to road construction", expected: false },
  { text: "University exam results published online", expected: false },
  { text: "Real estate prices rise in metro cities", expected: false },
];

let relPassed = 0;
let relFailed = 0;

for (const test of relevanceTests) {
  const result = cyberRelevanceDetector.isRelevant(test.text);
  const status = result.isRelevant === test.expected ? "PASS" : "FAIL";
  if (result.isRelevant === test.expected) relPassed++;
  else relFailed++;

  console.log(`${status} "${test.text.substring(0, 50)}..."`);
  console.log(`   Expected: ${test.expected ? "RELEVANT" : "NOT RELEVANT"}, Got: ${result.isRelevant ? "RELEVANT" : "NOT RELEVANT"}`);
  if (result.isRelevant !== test.expected) {
    console.log(`   Confidence: ${result.confidence}, Category: ${result.category}`);
  }
  console.log();
}

console.log(`\nRelevance Results: ${relPassed} passed, ${relFailed} failed\n`);

console.log("=== COMBINED TESTS ===\n");

const combinedTests: Array<{ text: string; expectedIndia: boolean; expectedRelevant: boolean }> = [
  { text: "Indiana-based cybersecurity firm discovers new malware", expectedIndia: false, expectedRelevant: true },
  { text: "Mumbai Metro smart card system faces cyberattack", expectedIndia: true, expectedRelevant: true },
  { text: "Cricket match in Bangalore stadium draws huge crowd", expectedIndia: true, expectedRelevant: false },
  { text: "New ransomware targets hospitals in US and Europe", expectedIndia: false, expectedRelevant: true },
  { text: "CERT-In warns about WhatsApp vulnerability affecting Indian users", expectedIndia: true, expectedRelevant: true },
];

for (const test of combinedTests) {
  const indiaResult = indiaDetector.isIndiaRelated(test.text);
  const relevanceResult = cyberRelevanceDetector.isRelevant(test.text);

  const indiaStatus = indiaResult.isIndia === test.expectedIndia ? "PASS" : "FAIL";
  const relevanceStatus = relevanceResult.isRelevant === test.expectedRelevant ? "PASS" : "FAIL";

  console.log(`"${test.text}"`);
  console.log(`  India: ${indiaStatus} (Expected: ${test.expectedIndia}, Got: ${indiaResult.isIndia})`);
  console.log(`  Cyber: ${relevanceStatus} (Expected: ${test.expectedRelevant}, Got: ${relevanceResult.isRelevant})`);
  console.log(`  -> Would appear in: ${relevanceResult.isRelevant ? (indiaResult.isIndia ? "LOCAL" : "GLOBAL") : "FILTERED OUT"}`);
  console.log();
}

console.log("=== TESTS COMPLETE ===");
