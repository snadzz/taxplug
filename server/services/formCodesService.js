// server/services/formCodesService.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-extraction';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../../documents');

// Cache for extracted codes
let codesCache = null;

/**
 * Extract code descriptions from the guide PDF
 * Looks for patterns like "Code: ABC - Description text"
 */
async function extractCodes() {
  if (codesCache) return codesCache;

  try {
    const guidePath = path.join(DOCS_DIR, 'PAYE-AE-06-G06-Guide-for-Codes-Applicable-to-Employees-Tax-Certificates-2026-External-Guide.pdf');
    
    if (!fs.existsSync(guidePath)) {
      console.warn('Guide PDF not found:', guidePath);
      return {};
    }

    const dataBuffer = fs.readFileSync(guidePath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    // Extract codes using regex patterns
    // Looking for patterns like: "Code: ABC" or "Code ABC" or "[ABC]" followed by description
    const codes = {};
    
    // Pattern 1: "Code: [A-Z0-9]+ - Description"
    const pattern1 = /Code:\s*([A-Z0-9]+)\s*[-–—]\s*(.+?)(?=Code:|$)/gi;
    let match;
    
    while ((match = pattern1.exec(text)) !== null) {
      const code = match[1].trim();
      const description = match[2].trim().split('\n')[0].slice(0, 200); // First line, max 200 chars
      if (code && description) {
        codes[code] = description;
      }
    }

    // Pattern 2: "[CODE] Description" format (in case guide uses brackets)
    const pattern2 = /\[([A-Z0-9]+)\]\s*[-–—]?\s*(.+?)(?=\[|Code:|$)/gi;
    while ((match = pattern2.exec(text)) !== null) {
      const code = match[1].trim();
      const description = match[2].trim().split('\n')[0].slice(0, 200);
      if (code && description && !codes[code]) {
        codes[code] = description;
      }
    }

    // Pattern 3: "CODE: X" where X is single or double letter
    const pattern3 = /\b([A-Z]{1,3})\s+[-–—]\s+(.+?)(?=\b[A-Z]{1,3}\s+[-–—]|Code:|$)/g;
    while ((match = pattern3.exec(text)) !== null) {
      const code = match[1].trim();
      const description = match[2].trim().split('\n')[0].slice(0, 200);
      // Only add if code is 1-3 letters and not already captured
      if (code.length <= 3 && description.length > 10 && !codes[code]) {
        codes[code] = description;
      }
    }

    codesCache = codes;
    console.log(`Extracted ${Object.keys(codes).length} codes from guide PDF`);
    return codes;
  } catch (error) {
    console.error('Error extracting codes:', error);
    return {};
  }
}

/**
 * Get codes (uses cache if available)
 */
export async function getCodes() {
  return await extractCodes();
}

/**
 * Get description for a specific code
 */
export async function getCodeDescription(code) {
  const codes = await extractCodes();
  return codes[code.toUpperCase()] || null;
}

/**
 * Refresh the cache (useful if guide PDF is updated)
 */
export async function refreshCodesCache() {
  codesCache = null;
  return await extractCodes();
}
