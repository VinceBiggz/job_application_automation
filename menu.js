// menu.gs
// Author: Vincent Wachira
// Version: v1.0
// Date: September 13, 2025
// Description: Creates a custom menu in the Google Sheet UI for on-demand runs of the Job Aggregator. Calls main.runJobSearch() on click.
// Dependencies: main.gs (runJobSearch)

/**
 * Runs when the spreadsheet is opened; creates custom menu
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('Job Aggregator')
      .addItem('Run Job Search', 'runJobSearch')
      .addToUi();
    logMessage('INFO', 'menu.onOpen', 'Menu Created', 'Custom menu added to sheet UI');
  } catch (error) {
    logMessage('ERROR', 'menu.onOpen', 'Menu Failed', `Failed to create menu: ${error.message}`);
  }
}

/**
 * Test function for menu module
 */
function testMenu() {
  try {
    onOpen();
    logMessage('INFO', 'menu.testMenu', 'Test Completed', 'Menu creation test passed');
  } catch (error) {
    logMessage('ERROR', 'menu.testMenu', 'Test Failed', `Test failed: ${error.message}`);
    throw error;
  }
}