// input.gs
// Author: Vincent Wachira
// Version: v1.1
// Date: September 13, 2025
// Description: Reads and sanitizes data from Config, Sources, and Filters tabs in the Google Sheet. Returns structured objects for downstream modules. Logging aligned with new Logs tab structure (ID, Module, Type, Message) using utils.logMessage(level, module, type, message). Updated getConfig() to expect Config tab header 'Key' instead of 'Setting'. Updated getActiveSources() to expect Sources tab headers 'SourceName, URL, Notes, Active' to match user-provided tab structure.
// Dependencies: utils.gs (logMessage, formatDate), SpreadsheetApp, PropertiesService
// Assumes: SHEET_ID set in Script Properties; Config tab has headers Key,Value; Sources tab has SourceName,URL,Notes,Active; Filters tab has Keyword,Weight,Type,Active.

/**
 * Reads and sanitizes Config tab
 * @returns {Object} Config object {emailRecipient, minScore, topN, dedupeBy, dateFormat}
 */
function getConfig() {
  try {
    logMessage('INFO', 'input.getConfig', 'Tab Read', 'Reading Config tab');

    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) {
      throw new Error('SHEET_ID not set in Script Properties');
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const configSheet = spreadsheet.getSheetByName('Config');
    if (!configSheet) {
      throw new Error('Config tab not found');
    }

    const data = configSheet.getDataRange().getValues();
    if (data.length < 2) {
      throw new Error('Config tab is empty or missing headers');
    }

    // Expected headers: Key, Value
    if (data[0][0] !== 'Key' || data[0][1] !== 'Value') {
      throw new Error('Config tab headers incorrect');
    }

    // Build config object
    const config = {};
    for (let i = 1; i < data.length; i++) {
      const setting = data[i][0];
      const value = data[i][1];
      if (!setting || value === '') {
        logMessage('WARN', 'input.getConfig', 'Invalid Data', `Skipping empty or invalid setting at row ${i + 1}`);
        continue;
      }
      config[setting] = value;
    }

    // Validate required fields
    const requiredFields = ['emailRecipient', 'minScore', 'topN', 'dedupeBy', 'dateFormat'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    // Sanitize and convert types
    config.minScore = Number(config.minScore);
    config.topN = Number(config.topN);
    if (isNaN(config.minScore) || isNaN(config.topN)) {
      throw new Error('minScore and topN must be numeric');
    }
    if (!config.emailRecipient.includes('@')) {
      throw new Error('Invalid emailRecipient');
    }
    if (config.dedupeBy !== 'link') {
      throw new Error('dedupeBy must be "link"');
    }
    if (!['yyyy-MM-dd'].includes(config.dateFormat)) {
      throw new Error('Invalid dateFormat');
    }

    logMessage('INFO', 'input.getConfig', 'Data Parsed', 'Successfully parsed Config tab');
    return config;
  } catch (error) {
    logMessage('ERROR', 'input.getConfig', 'Read Failed', `Failed to read Config: ${error.message}`);
    throw error;
  }
}

/**
 * Reads and sanitizes Sources tab, returning active sources
 * @returns {Array<Object>} Array of {SourceName, URL, Notes}
 */
function getActiveSources() {
  try {
    logMessage('INFO', 'input.getActiveSources', 'Tab Read', 'Reading Sources tab');

    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sourcesSheet = spreadsheet.getSheetByName('Sources');
    if (!sourcesSheet) {
      throw new Error('Sources tab not found');
    }

    const data = sourcesSheet.getDataRange().getValues();
    if (data.length < 2) {
      throw new Error('Sources tab is empty or missing headers');
    }

    // Expected headers: SourceName, URL, Notes, Active
    if (data[0][0] !== 'SourceName' || data[0][1] !== 'URL' || data[0][2] !== 'Notes' || data[0][3] !== 'Active') {
      throw new Error('Sources tab headers incorrect');
    }

    const sources = [];
    for (let i = 1; i < data.length; i++) {
      const sourceName = data[i][0];
      const url = data[i][1];
      const notes = data[i][2] || '';
      const active = data[i][3];

      // Validate row
      if (!sourceName || !url || typeof active !== 'boolean') {
        logMessage('WARN', 'input.getActiveSources', 'Invalid Data', `Skipping invalid source at row ${i + 1}`);
        continue;
      }

      // Only include active sources
      if (active) {
        // Basic URL validation
        if (!url.includes('http')) {
          logMessage('WARN', 'input.getActiveSources', 'Invalid URL', `Skipping invalid URL at row ${i + 1}: ${url}`);
          continue;
        }
        sources.push({ SourceName: sourceName, URL: url, Notes: notes });
      }
    }

    logMessage('INFO', 'input.getActiveSources', 'Data Parsed', `Parsed ${sources.length} active sources`);
    return sources;
  } catch (error) {
    logMessage('ERROR', 'input.getActiveSources', 'Read Failed', `Failed to read Sources: ${error.message}`);
    throw error;
  }
}

/**
 * Reads and sanitizes Filters tab, returning active filters
 * @returns {Array<Object>} Array of {Keyword, Weight, Type}
 */
function getActiveFilters() {
  try {
    logMessage('INFO', 'input.getActiveFilters', 'Tab Read', 'Reading Filters tab');

    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const filtersSheet = spreadsheet.getSheetByName('Filters');
    if (!filtersSheet) {
      throw new Error('Filters tab not found');
    }

    const data = filtersSheet.getDataRange().getValues();
    if (data.length < 2) {
      throw new Error('Filters tab is empty or missing headers');
    }

    // Expected headers: Keyword, Weight, Type, Active
    if (data[0][0] !== 'Keyword' || data[0][1] !== 'Weight' || data[0][2] !== 'Type' || data[0][3] !== 'Active') {
      throw new Error('Filters tab headers incorrect');
    }

    const filters = [];
    for (let i = 1; i < data.length; i++) {
      const keyword = data[i][0];
      const weight = data[i][1];
      const type = data[i][2];
      const active = data[i][3];

      // Validate row
      if (!keyword || isNaN(weight) || !type || typeof active !== 'boolean') {
        logMessage('WARN', 'input.getActiveFilters', 'Invalid Data', `Skipping invalid filter at row ${i + 1}`);
        continue;
      }

      // Only include active filters
      if (active) {
        // Validate Type
        if (!['title', 'any', 'negative'].includes(type.toLowerCase())) {
          logMessage('WARN', 'input.getActiveFilters', 'Invalid Type', `Skipping invalid filter Type at row ${i + 1}: ${type}`);
          continue;
        }
        filters.push({ Keyword: keyword, Weight: Number(weight), Type: type.toLowerCase() });
      }
    }

    logMessage('INFO', 'input.getActiveFilters', 'Data Parsed', `Parsed ${filters.length} active filters`);
    return filters;
  } catch (error) {
    logMessage('ERROR', 'input.getActiveFilters', 'Read Failed', `Failed to read Filters: ${error.message}`);
    throw error;
  }
}

/**
 * Test function for input module
 */
function testInput() {
  try {
    logMessage('INFO', 'input.testInput', 'Test Started', 'Starting input tests');

    // Test getConfig
    const config = getConfig();
    console.log('getConfig test:', JSON.stringify(config));
    if (!config.emailRecipient || isNaN(config.minScore) || isNaN(config.topN) || !config.dedupeBy || !config.dateFormat) {
      throw new Error('getConfig failed: missing or invalid fields');
    }

    // Test getActiveSources
    const sources = getActiveSources();
    console.log('getActiveSources test:', JSON.stringify(sources));
    if (!Array.isArray(sources) || sources.some(s => !s.SourceName || !s.URL)) {
      throw new Error('getActiveSources failed: invalid sources');
    }

    // Test getActiveFilters
    const filters = getActiveFilters();
    console.log('getActiveFilters test:', JSON.stringify(filters));
    if (!Array.isArray(filters) || filters.some(f => !f.Keyword || isNaN(f.Weight) || !['title', 'any', 'negative'].includes(f.Type))) {
      throw new Error('getActiveFilters failed: invalid filters');
    }

    logMessage('INFO', 'input.testInput', 'Test Completed', 'All input tests passed');
  } catch (error) {
    logMessage('ERROR', 'input.testInput', 'Test Failed', `Test failed: ${error.message}`);
    throw error;
  }
}