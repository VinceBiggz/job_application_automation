// appending.gs
// Author: Vincent Wachira
// Version: v1.1
// Date: September 13, 2025
// Description: Appends processed job objects to the Jobs tab in the specified column order: ID, DateFound, Title, Company, Location, Link, Source, Snippet, Score, MatchedKeywords, Status, DateNotified. Uses batch writes for performance and checks existing Links (from Jobs tab) and within-batch Links to avoid duplicates. Logging verified to align with new Logs tab structure (ID, Module, Type, Message) using utils.logMessage(level, module, type, message). Fixed deduplication bug to check Links within current batch.
// Dependencies: utils.gs (logMessage, generateUniqueID), input.gs (getConfig), SpreadsheetApp
// Assumes: SHEET_ID set in Script Properties; utils.gs v1.1 and input.gs v1.1 in place.

/**
 * Appends processed jobs to Jobs tab, skipping duplicates by Link
 * @param {Array<Object>} processedJobs - Array of jobs from output.processJobs {ID, DateFound, Title, Company, Location, Link, Source, Snippet, Score, MatchedKeywords, Status, DateNotified}
 * @param {Object} config - Config object from input.getConfig {minScore, dedupeBy, etc.}
 * @returns {number} Number of jobs appended
 */
function appendJobs(processedJobs, config) {
  try {
    logMessage('INFO', 'appending.appendJobs', 'Data Write', `Starting append for ${processedJobs.length} jobs`);

    // Validate inputs
    if (!Array.isArray(processedJobs) || !config) {
      throw new Error('Invalid input: processedJobs or config is missing/invalid');
    }
    if (!config.dedupeBy || !config.minScore) {
      throw new Error('Missing required config fields: dedupeBy or minScore');
    }
    if (config.dedupeBy !== 'link') {
      throw new Error('dedupeBy must be "link"');
    }

    // Get sheet
    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) {
      throw new Error('SHEET_ID not set in Script Properties');
    }
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const jobsSheet = spreadsheet.getSheetByName('Jobs');
    if (!jobsSheet) {
      throw new Error('Jobs tab not found');
    }

    // Get existing Links for deduplication
    const existingLinks = getExistingLinks(jobsSheet);
    const seenLinksInBatch = new Set(); // Track Links in current batch
    const jobsToAppend = [];

    // Validate and prepare jobs
    for (const job of processedJobs) {
      // Check required fields
      if (!job.ID || !job.DateFound || !job.Title || !job.Link || !job.Source || !job.Snippet || job.Score === undefined || !job.MatchedKeywords || !job.Status || job.DateNotified === undefined) {
        logMessage('WARN', 'appending.appendJobs', 'Invalid Data', `Skipping job with missing fields: ${JSON.stringify(job).substring(0, 100)}`);
        continue;
      }

      // Skip duplicates (existing in Jobs tab or within batch)
      if (existingLinks.has(job.Link) || seenLinksInBatch.has(job.Link)) {
        logMessage('INFO', 'appending.appendJobs', 'Duplicate Found', `Skipping duplicate job: ${job.Title} (${job.Link})`);
        continue;
      }
      seenLinksInBatch.add(job.Link);

      // Ensure Status is valid
      if (!['New', 'Ignore', 'Applied', 'Interviewing', 'Rejected'].includes(job.Status)) {
        logMessage('WARN', 'appending.appendJobs', 'Invalid Status', `Invalid Status for job ${job.Title}: ${job.Status}, setting to Ignore`);
        job.Status = 'Ignore';
      }

      jobsToAppend.push([
        job.ID,
        job.DateFound,
        job.Title,
        job.Company,
        job.Location,
        job.Link,
        job.Source,
        job.Snippet,
        job.Score,
        job.MatchedKeywords,
        job.Status,
        job.DateNotified
      ]);
    }

    // Batch append if any jobs remain
    let appendedCount = 0;
    if (jobsToAppend.length > 0) {
      const lastRow = jobsSheet.getLastRow();
      const range = jobsSheet.getRange(lastRow + 1, 1, jobsToAppend.length, 12); // 12 columns
      range.setValues(jobsToAppend);
      appendedCount = jobsToAppend.length;
      logMessage('INFO', 'appending.appendJobs', 'Data Write', `Appended ${appendedCount} jobs to Jobs tab`);
    } else {
      logMessage('INFO', 'appending.appendJobs', 'No Data', 'No new jobs to append after deduplication');
    }

    return appendedCount;
  } catch (error) {
    logMessage('ERROR', 'appending.appendJobs', 'Write Failed', `Failed to append jobs: ${error.message}`);
    throw error; // Re-throw for caller to handle
  }
}

/**
 * Retrieves existing Links from Jobs tab for deduplication
 * @param {Sheet} jobsSheet - Jobs tab sheet object
 * @returns {Set<string>} Set of existing Link URLs
 */
function getExistingLinks(jobsSheet) {
  try {
    logMessage('INFO', 'appending.getExistingLinks', 'Data Read', 'Reading existing Links from Jobs tab');

    const lastRow = jobsSheet.getLastRow();
    if (lastRow <= 1) {
      logMessage('INFO', 'appending.getExistingLinks', 'No Data', 'Jobs tab is empty (only headers)');
      return new Set();
    }

    // Read Link column (column 6: F)
    const links = jobsSheet.getRange(2, 6, lastRow - 1, 1).getValues().flat();
    return new Set(links.filter(link => link && typeof link === 'string' && link.includes('http')));
  } catch (error) {
    logMessage('ERROR', 'appending.getExistingLinks', 'Read Failed', `Failed to read existing Links: ${error.message}`);
    throw error;
  }
}

/**
 * Test function for appending module
 */
function testAppending() {
  try {
    logMessage('INFO', 'appending.testAppending', 'Test Started', 'Starting appending tests');

    // Mock config
    const mockConfig = {
      minScore: 1,
      dedupeBy: 'link',
      dateFormat: 'yyyy-MM-dd'
    };

    // Mock jobs
    const mockJobs = [
      {
        ID: generateUniqueID(),
        DateFound: formatDate(new Date(), mockConfig.dateFormat),
        Title: 'Test Job 1',
        Company: 'Test Corp',
        Location: 'Remote',
        Link: 'https://example.com/job1',
        Source: 'TestSource',
        Snippet: 'Test Job 1 from TestSource',
        Score: 10,
        MatchedKeywords: 'CIO,Remote',
        Status: 'New',
        DateNotified: ''
      },
      {
        ID: generateUniqueID(),
        DateFound: formatDate(new Date(), mockConfig.dateFormat),
        Title: 'Test Job 2',
        Company: '',
        Location: '',
        Link: 'https://example.com/job2',
        Source: 'TestSource',
        Snippet: 'Test Job 2 from TestSource',
        Score: -5,
        MatchedKeywords: 'Junior',
        Status: 'Ignore',
        DateNotified: ''
      },
      {
        ID: generateUniqueID(),
        DateFound: formatDate(new Date(), mockConfig.dateFormat),
        Title: 'Duplicate Job',
        Company: 'Test Corp',
        Location: 'Remote',
        Link: 'https://example.com/job1', // Duplicate
        Source: 'TestSource',
        Snippet: 'Duplicate Job from TestSource',
        Score: 10,
        MatchedKeywords: 'CIO',
        Status: 'New',
        DateNotified: ''
      }
    ];

    // Get sheet for manual verification
    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) {
      throw new Error('SHEET_ID not set in Script Properties');
    }
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const jobsSheet = spreadsheet.getSheetByName('Jobs');
    if (!jobsSheet) {
      throw new Error('Jobs tab not found');
    }

    // Clear Jobs tab data (keep headers) for clean test
    if (jobsSheet.getLastRow() > 1) {
      jobsSheet.getRange(2, 1, jobsSheet.getLastRow() - 1, 12).clearContent();
    }

    // Test 1: Append jobs
    const initialLastRow = jobsSheet.getLastRow();
    const appendedCount = appendJobs(mockJobs, mockConfig);
    const newLastRow = jobsSheet.getLastRow();
    console.log(`appendJobs test: Appended ${appendedCount} jobs, last row ${initialLastRow} -> ${newLastRow}`);
    if (appendedCount !== 2 || newLastRow !== initialLastRow + 2) {
      throw new Error(`Expected 2 jobs appended, got ${appendedCount}, last row ${newLastRow}`);
    }

    // Test 2: Verify deduplication
    const linksAfter = getExistingLinks(jobsSheet);
    if (!linksAfter.has('https://example.com/job1') || !linksAfter.has('https://example.com/job2')) {
      throw new Error('Expected Links not found in Jobs tab');
    }
    if (linksAfter.size !== 2) {
      throw new Error(`Expected 2 unique Links, got ${linksAfter.size}`);
    }

    // Test 3: Invalid job
    const invalidJob = [{
      ID: generateUniqueID(),
      DateFound: formatDate(new Date(), mockConfig.dateFormat),
      Title: '', // Missing Title
      Company: '',
      Location: '',
      Link: 'https://example.com/job3',
      Source: 'TestSource',
      Snippet: 'Invalid Job from TestSource',
      Score: 0,
      MatchedKeywords: '',
      Status: 'Ignore',
      DateNotified: ''
    }];
    const invalidCount = appendJobs(invalidJob, mockConfig);
    if (invalidCount !== 0) {
      throw new Error('Invalid job was appended');
    }

    logMessage('INFO', 'appending.testAppending', 'Test Completed', 'All appending tests passed');
  } catch (error) {
    logMessage('ERROR', 'appending.testAppending', 'Test Failed', `Test failed: ${error.message}`);
    throw error;
  }
}