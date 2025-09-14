// main.gs
// Author: Vincent Wachira
// Version: v1.0
// Date: September 13, 2025
// Description: Orchestrates the full Job Aggregator flow: input, scrape, process, append, email. Includes setup for Script Properties and triggers. Entry point for menu and scheduled runs.
// Dependencies: All other .gs files

/**
 * Main entry point: Runs full job search automation
 */
function runJobSearch() {
  try {
    logMessage('INFO', 'main.runJobSearch', 'Automation Started', 'Starting full job search automation');

    const config = getConfig();
    const sources = getActiveSources();
    const filters = getActiveFilters();

    if (sources.length === 0) {
      logMessage('WARN', 'main.runJobSearch', 'No Sources', 'No active sources found; skipping scrape');
      return;
    }

    const rawJobs = scrapeJobs(sources);
    const processedJobs = processJobs(rawJobs, filters, config);
    const appendedCount = appendJobs(processedJobs, config);
    const emailedCount = sendJobDigest(config);

    logMessage('INFO', 'main.runJobSearch', 'Automation Completed', `Appended ${appendedCount} jobs; emailed ${emailedCount} jobs`);
  } catch (error) {
    logMessage('ERROR', 'main.runJobSearch', 'Automation Failed', `Full run failed: ${error.message}`);
    throw error;
  }
}

/**
 * Sets up Script Properties (run once)
 */
function setupScriptProperties() {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty('SHEET_ID', '1fwfkdyReTRCMywq6VmQT7XN5KVu0DWcBOpY0XOxgoD0'); // Replace with your ID
    logMessage('INFO', 'main.setupScriptProperties', 'Setup Completed', 'Script Properties configured');
  } catch (error) {
    logMessage('ERROR', 'main.setupScriptProperties', 'Setup Failed', `Failed to set properties: ${error.message}`);
    throw error;
  }
}

/**
 * Sets up daily trigger (run once)
 */
function setupTriggers() {
  try {
    ScriptApp.newTrigger('runJobSearch')
      .timeBased()
      .everyDays(1)
      .atHour(8) // 8 AM daily
      .create();
    logMessage('INFO', 'main.setupTriggers', 'Trigger Created', 'Daily trigger set for 8 AM');
  } catch (error) {
    logMessage('ERROR', 'main.setupTriggers', 'Trigger Failed', `Failed to create trigger: ${error.message}`);
    throw error;
  }
}

/**
 * Test function for main module (end-to-end)
 */
function testMain() {
  try {
    logMessage('INFO', 'main.testMain', 'Test Started', 'Starting end-to-end test');
    runJobSearch();
    logMessage('INFO', 'main.testMain', 'Test Completed', 'End-to-end test passed');
  } catch (error) {
    logMessage('ERROR', 'main.testMain', 'Test Failed', `End-to-end test failed: ${error.message}`);
    throw error;
  }
}