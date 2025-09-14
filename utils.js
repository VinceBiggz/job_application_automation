// utils.gs
// Author: Vincent Wachira
// Version: v1.3
// Date: September 13, 2025
// Description: Utility functions for logging, date formatting, and ID generation. Logging aligned with new Logs tab structure (ID, Module, Type, Message). Fixed createLogsTabIfNeeded to handle invalid spreadsheet objects. Fixed generateUniqueID to validate type parameter and prevent undefined errors.
// Dependencies: SpreadsheetApp, PropertiesService
// Assumes: SHEET_ID set in Script Properties; Logs tab has headers ID,Module,Type,Message.

/**
 * Logs a message to the Logs tab
 * @param {string} type - Log type (INFO, WARN, ERROR)
 * @param {string} module - Module name (e.g., main, scraper)
 * @param {string} label - Log label (e.g., Scrape Started)
 * @param {string} message - Log message
 */
function logMessage(type, module, label, message) {
  try {
    // Validate inputs
    if (!type || typeof type !== 'string') {
      console.error(`[UNKNOWN] ${module || 'unknown'}.${label || 'unknown'}: ${message} (Invalid log type)`);
      return;
    }
    if (!module || !label || !message) {
      console.error(`[${type}] ${module || 'unknown'}.${label || 'unknown'}: ${message || 'no message'} (Missing log parameters)`);
      return;
    }

    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) {
      console.error(`[${type}] ${module}.${label}: ${message} (SHEET_ID not set)`);
      return;
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const logsSheet = createLogsTabIfNeeded(spreadsheet);
    if (!logsSheet) {
      console.error(`[${type}] ${module}.${label}: ${message} (Logs tab unavailable)`);
      return;
    }

    const logId = generateUniqueID(type);
    logsSheet.appendRow([logId, module, type, `${label}: ${message}`]);
    console.log(`[${logId}] ${type} ${module} ${label}: ${message}`);
  } catch (error) {
    console.error(`[${type || 'UNKNOWN'}] ${module || 'unknown'}.${label || 'unknown'}: ${message || 'no message'} (Log failed: ${error.message})`);
  }
}

/**
 * Creates Logs tab if it doesn't exist
 * @param {Spreadsheet} spreadsheet - Spreadsheet object
 * @returns {Sheet|null} Logs sheet or null if creation fails
 */
function createLogsTabIfNeeded(spreadsheet) {
  try {
    if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function') {
      console.error('createLogsTabIfNeeded: Invalid spreadsheet object');
      return null;
    }

    let logsSheet = spreadsheet.getSheetByName('Logs');
    if (!logsSheet) {
      if (typeof spreadsheet.insertSheet !== 'function') {
        console.error('createLogsTabIfNeeded: spreadsheet.insertSheet is not a function');
        return null;
      }

      logsSheet = spreadsheet.insertSheet('Logs');
      logsSheet.appendRow(['ID', 'Module', 'Type', 'Message']);
      logsSheet.getRange('1:1').setFontWeight('bold');
      logsSheet.setFrozenRows(1);
    }

    return logsSheet;
  } catch (error) {
    console.error(`createLogsTabIfNeeded: Failed to create Logs tab: ${error.message}`);
    return null;
  }
}

/**
 * Formats a date to the specified format
 * @param {Date} date - Date object
 * @param {string} format - Format string (e.g., yyyy-MM-dd)
 * @returns {string} Formatted date
 */
function formatDate(date, format) {
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    let formatted = format
      .replace('yyyy', year)
      .replace('MM', month)
      .replace('dd', day);
    return formatted;
  } catch (error) {
    console.error(`formatDate: Failed to format date: ${error.message}`);
    return date.toISOString().split('T')[0];
  }
}

/**
 * Generates a unique ID for logs
 * @param {string} type - Log type (INFO, WARN, ERROR)
 * @returns {string} Unique ID (e.g., INFO-001)
 */
function generateUniqueID(type) {
  try {
    // Validate type
    if (!type || typeof type !== 'string') {
      console.error(`generateUniqueID: Invalid type parameter: ${type}`);
      return 'UNKNOWN-000';
    }

    const scriptProperties = PropertiesService.getScriptProperties();
    const key = `${type.toUpperCase()}_COUNTER`;
    let counter = parseInt(scriptProperties.getProperty(key) || '0', 10) + 1;
    scriptProperties.setProperty(key, counter.toString());
    return `${type.toUpperCase()}-${String(counter).padStart(3, '0')}`;
  } catch (error) {
    console.error(`generateUniqueID: Failed to generate ID: ${error.message}`);
    return 'UNKNOWN-000';
  }
}

/**
 * Test function for utils module
 */
function testUtils() {
  try {
    console.log('Starting utils tests');

    // Mock SpreadsheetApp for testing
    const mockSpreadsheet = {
      getSheetByName: (name) => {
        if (name === 'Logs') {
          return {
            appendRow: (row) => console.log('Mock appendRow:', row),
            getRange: () => ({
              setFontWeight: () => console.log('Mock setFontWeight: bold')
            }),
            setFrozenRows: () => console.log('Mock setFrozenRows: 1')
          };
        }
        return null;
      },
      insertSheet: (name) => ({
        appendRow: (row) => console.log('Mock appendRow:', row),
        getRange: () => ({
          setFontWeight: () => console.log('Mock setFontWeight: bold')
        }),
        setFrozenRows: () => console.log('Mock setFrozenRows: 1')
      })
    };

    SpreadsheetApp.openById = () => mockSpreadsheet;

    // Test logMessage
    logMessage('INFO', 'utils', 'Test Log', 'Testing log message');
    console.log('logMessage test: should log to console');

    // Test formatDate
    const date = new Date('2025-09-13');
    const formatted = formatDate(date, 'yyyy-MM-dd');
    console.log('formatDate test:', formatted);
    if (formatted !== '2025-09-13') {
      throw new Error('formatDate failed: expected 2025-09-13');
    }

    // Test generateUniqueID
    const id = generateUniqueID('INFO');
    console.log('generateUniqueID test:', id);
    if (!id.startsWith('INFO-')) {
      throw new Error('generateUniqueID failed: expected INFO- prefix');
    }

    // Test generateUniqueID with invalid type
    const invalidId = generateUniqueID(undefined);
    console.log('generateUniqueID invalid test:', invalidId);
    if (invalidId !== 'UNKNOWN-000') {
      throw new Error('generateUniqueID failed: expected UNKNOWN-000 for undefined type');
    }

    console.log('All utils tests passed');
  } catch (error) {
    console.error('Test failed:', error.message);
    throw error;
  }
}