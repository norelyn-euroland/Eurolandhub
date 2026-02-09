/**
 * CSV Parser Utility
 * Parses CSV files directly without markdown conversion
 */

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parse CSV content to headers and rows
 * Handles quoted values, empty columns, and normalizes headers
 */
export function parseCSV(csvText: string): ParsedCSV {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Handle quoted CSV values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rows = lines.map(parseCSVLine);
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);

  return { headers, rows: dataRows };
}

/**
 * Normalize header name for matching (lowercase, trim, handle underscores/spaces)
 */
export function normalizeHeaderName(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_').replace(/_+/g, '_');
}

/**
 * Read CSV file as text
 */
export function readCSVFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    reader.onerror = (e) => {
      reject(new Error('Failed to read CSV file'));
    };
    reader.readAsText(file);
  });
}


