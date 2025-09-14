// email.gs
// Author: Vincent Wachira
// Version: v1.2
// Date: September 13, 2025
// Description: Sends HTML email notifications with job digest (top N jobs by score) using emailTemplate.html and updates Jobs tab with DateNotified and Status='Notified'. Logging aligned with new Logs tab structure (ID, Module, Type, Message). Fixed buildHtmlTable() to handle missing job fields gracefully. Fixed testEmail() to clear Jobs tab and add mock jobs for sendJobDigest() test to ensure correct job count.
// Dependencies: utils.gs (logMessage, formatDate, generateUniqueID), input.gs (getConfig), SpreadsheetApp, GmailApp, HtmlService, DocumentApp
// Assumes: SHEET_ID and coverLetterDocId set in Script Properties or Config tab; emailTemplate.html exists; Jobs tab has correct headers.

/**
 * Sends job digest email and updates Jobs tab
 * @param {Object} config - Config from input.getConfig {emailRecipient, topN, etc.}
 * @returns {number} Number of jobs emailed
 */
function sendJobDigest(config) {
  try {
    logMessage('INFO', 'email.sendJobDigest', 'Email Processing', 'Starting job digest email process');

    // Validate config
    if (!config || !config.emailRecipient || !config.topN || !config.coverLetterDocId) {
      throw new Error('Missing required config: emailRecipient, topN, or coverLetterDocId');
    }

    // Get Jobs tab
    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) {
      throw new Error('SHEET_ID not set in Script Properties');
    }
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const jobsSheet = spreadsheet.getSheetByName('Jobs');
    if (!jobsSheet) {
      throw new Error('Jobs tab not found');
    }

    // Get jobs data
    const lastRow = jobsSheet.getLastRow();
    if (lastRow <= 1) {
      logMessage('INFO', 'email.sendJobDigest', 'No Data', 'No jobs to email');
      return 0;
    }

    const data = jobsSheet.getRange(2, 1, lastRow - 1, 12).getValues();
    const jobs = data.map(row => ({
      ID: row[0],
      DateFound: row[1],
      Title: row[2],
      Company: row[3],
      Location: row[4],
      Link: row[5],
      Source: row[6],
      Snippet: row[7],
      Score: row[8],
      MatchedKeywords: row[9],
      Status: row[10],
      DateNotified: row[11]
    }));

    // Filter and sort jobs
    const eligibleJobs = jobs.filter(job => 
      job.Status === 'New' && 
      job.Score >= config.minScore && 
      !job.DateNotified
    ).sort((a, b) => b.Score - a.Score).slice(0, config.topN);

    if (eligibleJobs.length === 0) {
      logMessage('INFO', 'email.sendJobDigest', 'No Data', 'No eligible jobs to email');
      return 0;
    }

    // Generate HTML table
    const htmlTable = buildHtmlTable(eligibleJobs);

    // Load email template
    const template = HtmlService.createTemplateFromFile('emailTemplate');
    template.jobsTable = htmlTable;
    template.today = formatDate(new Date(), config.dateFormat);
    const htmlBody = template.evaluate().getContent();

    // Get cover letter text
    let coverLetterText = '';
    try {
      const doc = DocumentApp.openById(config.coverLetterDocId);
      coverLetterText = doc.getBody().getText().substring(0, 500); // Limit length
    } catch (error) {
      logMessage('WARN', 'email.sendJobDigest', 'Doc Read Failed', `Failed to read cover letter: ${error.message}`);
    }

    // Send email
    GmailApp.sendEmail(config.emailRecipient, `Job Search Update - ${formatDate(new Date(), config.dateFormat)}`, 
      `Found ${eligibleJobs.length} new jobs:\n\n${coverLetterText}`, 
      { htmlBody: htmlBody });

    // Update Jobs tab
    const updatedCount = updateNotifiedJobs(jobsSheet, eligibleJobs, config.dateFormat);
    
    logMessage('INFO', 'email.sendJobDigest', 'Email Sent', `Sent digest with ${eligibleJobs.length} jobs; updated ${updatedCount} rows`);
    return eligibleJobs.length;
  } catch (error) {
    logMessage('ERROR', 'email.sendJobDigest', 'Email Failed', `Failed to send digest: ${error.message}`);
    throw error;
  }
}

/**
 * Builds HTML table for email
 * @param {Array<Object>} jobs - Array of jobs to include
 * @returns {string} HTML table string
 */
function buildHtmlTable(jobs) {
  try {
    logMessage('INFO', 'email.buildHtmlTable', 'Table Generation', `Building HTML table for ${jobs.length} jobs`);

    // Validate input
    if (!Array.isArray(jobs) || jobs.length === 0) {
      throw new Error('No jobs provided for table');
    }

    let html = '<table style="border-collapse: collapse; width: 100%; max-width: 600px; font-family: Arial, sans-serif;">';
    html += '<tr style="background-color: #f2f2f2;">';
    html += '<th style="border: 1px solid #ddd; padding: 8px;">Title</th>';
    html += '<th style="border: 1px solid #ddd; padding: 8px;">Source</th>';
    html += '<th style="border: 1px solid #ddd; padding: 8px;">Score</th>';
    html += '<th style="border: 1px solid #ddd; padding: 8px;">Keywords</th>';
    html += '</tr>';

    for (const job of jobs) {
      // Validate required fields
      if (!job.Title || !job.Link) {
        logMessage('WARN', 'email.buildHtmlTable', 'Invalid Data', `Skipping job with missing Title or Link: ${JSON.stringify(job).substring(0, 100)}`);
        continue;
      }

      html += '<tr>';
      html += `<td style="border: 1px solid #ddd; padding: 8px;"><a href="${job.Link}">${job.Title || 'N/A'}</a></td>`;
      html += `<td style="border: 1px solid #ddd; padding: 8px;">${job.Source || 'N/A'}</td>`;
      html += `<td style="border: 1px solid #ddd; padding: 8px;">${job.Score !== undefined ? job.Score : 'N/A'}</td>`;
      html += `<td style="border: 1px solid #ddd; padding: 8px;">${job.MatchedKeywords || 'None'}</td>`;
      html += '</tr>';
    }

    html += '</table>';

    if (html === '<table style="border-collapse: collapse; width: 100%; max-width: 600px; font-family: Arial, sans-serif;"><tr style="background-color: #f2f2f2;"><th style="border: 1px solid #ddd; padding: 8px;">Title</th><th style="border: 1px solid #ddd; padding: 8px;">Source</th><th style="border: 1px solid #ddd; padding: 8px;">Score</th><th style="border: 1px solid #ddd; padding: 8px;">Keywords</th></tr></table>') {
      throw new Error('No valid jobs included in table');
    }

    logMessage('INFO', 'email.buildHtmlTable', 'Table Generation', 'HTML table generated successfully');
    return html;
  } catch (error) {
    logMessage('ERROR', 'email.buildHtmlTable', 'Table Failed', `Failed to build HTML table: ${error.message}`);
    throw error;
  }
}

/**
 * Updates Jobs tab with DateNotified and Status='Notified'
 * @param {Sheet} jobsSheet - Jobs tab sheet object
 * @param {Array<Object>} emailedJobs - Jobs included in email
 * @param {string} dateFormat - Date format from config
 * @returns {number} Number of rows updated
 */
function updateNotifiedJobs(jobsSheet, emailedJobs, dateFormat) {
  try {
    logMessage('INFO', 'email.updateNotifiedJobs', 'Data Update', `Updating ${emailedJobs.length} jobs in Jobs tab`);

    const lastRow = jobsSheet.getLastRow();
    if (lastRow <= 1) {
      logMessage('INFO', 'email.updateNotifiedJobs', 'No Data', 'Jobs tab is empty (no updates needed)');
      return 0;
    }

    const data = jobsSheet.getRange(2, 1, lastRow - 1, 12).getValues();
    let updatedCount = 0;
    const today = formatDate(new Date(), dateFormat);

    for (let i = 0; i < data.length; i++) {
      const jobId = data[i][0];
      if (emailedJobs.some(job => job.ID === jobId)) {
        jobsSheet.getRange(i + 2, 11).setValue('Notified'); // Status (column K)
        jobsSheet.getRange(i + 2, 12).setValue(today); // DateNotified (column L)
        updatedCount++;
      }
    }

    logMessage('INFO', 'email.updateNotifiedJobs', 'Data Update', `Updated ${updatedCount} jobs with Status=Notified and DateNotified`);
    return updatedCount;
  } catch (error) {
    logMessage('ERROR', 'email.updateNotifiedJobs', 'Update Failed', `Failed to update Jobs tab: ${error.message}`);
    throw error;
  }
}

/**
 * Test function for email module
 */
function testEmail() {
  try {
    logMessage('INFO', 'email.testEmail', 'Test Started', 'Starting email tests');

    // Mock config
    const mockConfig = {
      emailRecipient: 'test@example.com',
      topN: 5,
      minScore: 1,
      dateFormat: 'yyyy-MM-dd',
      coverLetterDocId: 'mockDocId123'
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
        Score: 5,
        MatchedKeywords: 'Developer',
        Status: 'New',
        DateNotified: ''
      }
    ];

    // Get sheet for controlled test
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

    // Add mock jobs to Jobs tab
    const mockData = mockJobs.map(job => [
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
    if (mockData.length > 0) {
      jobsSheet.getRange(2, 1, mockData.length, 12).setValues(mockData);
    }

    // Test buildHtmlTable
    const htmlTable = buildHtmlTable(mockJobs);
    console.log('buildHtmlTable test:', htmlTable);
    if (!htmlTable.includes('Test Job 1') || !htmlTable.includes('Test Job 2') || !htmlTable.includes('https://example.com/job1') || !htmlTable.includes('https://example.com/job2')) {
      throw new Error('buildHtmlTable failed: missing job data');
    }

    // Mock GmailApp and DocumentApp for dry-run
    GmailApp = {
      sendEmail: (recipient, subject, body, options) => {
        console.log('Mock sendEmail:', { recipient, subject, body, htmlBody: options.htmlBody });
      }
    };
    DocumentApp = {
      openById: () => ({
        getBody: () => ({
          getText: () => 'Mock cover letter text'
        })
      })
    };

    // Test sendJobDigest (dry-run)
    const emailedCount = sendJobDigest(mockConfig);
    console.log('sendJobDigest test: emailed', emailedCount, 'jobs');
    if (emailedCount !== mockJobs.length) {
      throw new Error(`sendJobDigest failed: expected ${mockJobs.length} jobs, got ${emailedCount}`);
    }

    // Test updateNotifiedJobs (mock sheet)
    const mockSheet = {
      getLastRow: () => mockJobs.length + 1,
      getRange: (row, col, numRows, numCols) => ({
        getValues: () => mockData,
        setValue: (value) => console.log('Mock setValue:', value)
      })
    };
    const updatedCount = updateNotifiedJobs(mockSheet, mockJobs, mockConfig.dateFormat);
    console.log('updateNotifiedJobs test: updated', updatedCount, 'rows');
    if (updatedCount !== mockJobs.length) {
      throw new Error(`updateNotifiedJobs failed: expected ${mockJobs.length} rows, got ${updatedCount}`);
    }

    logMessage('INFO', 'email.testEmail', 'Test Completed', 'All email tests passed');
  } catch (error) {
    logMessage('ERROR', 'email.testEmail', 'Test Failed', `Test failed: ${error.message}`);
    throw error;
  }
}