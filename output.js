// output.gs
// Author: Vincent Wachira
// Version: v1.1
// Date: September 13, 2025
// Description: Processes raw job objects from scraper.gs by scoring based on Filters, deduplicating by Link, setting Status (New/Ignore), formatting Snippet, and adding MatchedKeywords. Returns processed jobs for appending to Jobs tab. Uses additive scoring (no cap) and logs to four-column Logs tab (ID, Module, Type, Message). Logging verified to align with utils.gs v1.1.
// Dependencies: utils.gs (logMessage, generateUniqueID), input.gs (getActiveFilters, getConfig)
// Assumes: SHEET_ID set in Script Properties; utils.gs v1.1 and input.gs v1.1 in place.

/**
 * Processes raw jobs by scoring, deduplicating, and formatting
 * @param {Array<Object>} rawJobs - Array of jobs from scraper.gs {ID, DateFound, Title, Company, Location, Link, Source, Snippet}
 * @param {Array<Object>} filters - Array of filters from input.getActiveFilters {Keyword, Weight, Type}
 * @param {Object} config - Config object from input.getConfig {minScore, dedupeBy, etc.}
 * @returns {Array<Object>} Processed jobs with Score, MatchedKeywords, Status, formatted Snippet
 */
function processJobs(rawJobs, filters, config) {
  try {
    logMessage('INFO', 'output.processJobs', 'Job Processing', `Starting processing for ${rawJobs.length} raw jobs`);

    // Validate inputs
    if (!Array.isArray(rawJobs) || !Array.isArray(filters) || !config) {
      throw new Error('Invalid input: rawJobs, filters, or config is missing/invalid');
    }
    if (!config.minScore || !config.dedupeBy) {
      throw new Error('Missing required config fields: minScore or dedupeBy');
    }

    // Process each job
    const processedJobs = [];
    const seenLinks = new Set();

    for (const job of rawJobs) {
      // Skip invalid jobs
      if (!job.Title || !job.Link || !job.Source) {
        logMessage('WARN', 'output.processJobs', 'Invalid Data', `Skipping job with missing Title/Link/Source: ${JSON.stringify(job).substring(0, 100)}`);
        continue;
      }

      // Deduplicate by Link
      if (config.dedupeBy === 'link' && seenLinks.has(job.Link)) {
        logMessage('INFO', 'output.processJobs', 'Duplicate Found', `Skipping duplicate job: ${job.Title} (${job.Link})`);
        continue;
      }
      seenLinks.add(job.Link);

      // Calculate score and matched keywords
      const { score, matchedKeywords } = calculateScore(job, filters);

      // Format job
      const processedJob = {
        ID: job.ID || generateUniqueID(), // Fallback if scraper failed to set
        DateFound: job.DateFound,
        Title: job.Title,
        Company: job.Company || '',
        Location: job.Location || '',
        Link: job.Link,
        Source: job.Source,
        Snippet: `${job.Title} from ${job.Source}`, // Per requirement
        Score: score,
        MatchedKeywords: matchedKeywords.join(', '),
        Status: score >= config.minScore ? 'New' : 'Ignore',
        DateNotified: '' // Initialize empty
      };

      processedJobs.push(processedJob);
    }

    logMessage('INFO', 'output.processJobs', 'Job Processing', `Processed ${processedJobs.length} jobs (from ${rawJobs.length} raw)`);
    return processedJobs;
  } catch (error) {
    logMessage('ERROR', 'output.processJobs', 'Processing Failed', `Failed to process jobs: ${error.message}`);
    throw error; // Re-throw for caller to handle
  }
}

/**
 * Calculates score and matched keywords for a single job
 * @param {Object} job - Job object {Title, Company, Location, Source, Snippet}
 * @param {Array<Object>} filters - Array of filters {Keyword, Weight, Type}
 * @returns {Object} {score: number, matchedKeywords: Array<string>}
 */
function calculateScore(job, filters) {
  try {
    let score = 0;
    const matchedKeywords = [];

    // Validate inputs
    if (!job || !filters) {
      throw new Error('Invalid job or filters');
    }

    // Combine fields for 'any' type matching
    const allText = `${job.Title} ${job.Company} ${job.Location} ${job.Snippet}`.toLowerCase();

    for (const filter of filters) {
      const keyword = filter.Keyword.toLowerCase();
      let isMatch = false;

      // Check based on filter Type
      if (filter.Type === 'title') {
        isMatch = job.Title.toLowerCase().includes(keyword);
      } else if (filter.Type === 'any' || filter.Type === 'negative') {
        isMatch = allText.includes(keyword);
      }

      if (isMatch) {
        score += filter.Weight;
        matchedKeywords.push(filter.Keyword);
      }
    }

    return { score, matchedKeywords };
  } catch (error) {
    logMessage('ERROR', 'output.calculateScore', 'Scoring Failed', `Failed to calculate score: ${error.message}`);
    throw error;
  }
}

/**
 * Test function for output module
 */
function testOutput() {
  try {
    logMessage('INFO', 'output.testOutput', 'Test Started', 'Starting output tests');

    // Mock config
    const mockConfig = {
      minScore: 1,
      dedupeBy: 'link',
      dateFormat: 'yyyy-MM-dd'
    };

    // Mock filters
    const mockFilters = [
      { Keyword: 'CIO', Weight: 10, Type: 'title' },
      { Keyword: 'Remote', Weight: 4, Type: 'any' },
      { Keyword: 'Junior', Weight: -10, Type: 'negative' }
    ];

    // Mock jobs
    const mockJobs = [
      {
        ID: generateUniqueID(),
        DateFound: formatDate(new Date(), mockConfig.dateFormat),
        Title: 'CIO Position',
        Company: 'Tech Corp',
        Location: 'Remote',
        Link: 'https://example.com/job1',
        Source: 'TestSource',
        Snippet: 'CIO Position from TestSource'
      },
      {
        ID: generateUniqueID(),
        DateFound: formatDate(new Date(), mockConfig.dateFormat),
        Title: 'Junior Developer',
        Company: 'Startup Inc',
        Location: 'NY',
        Link: 'https://example.com/job2',
        Source: 'TestSource',
        Snippet: 'Junior Developer from TestSource'
      },
      {
        ID: generateUniqueID(),
        DateFound: formatDate(new Date(), mockConfig.dateFormat),
        Title: 'CIO Duplicate',
        Company: 'Tech Corp',
        Location: 'Remote',
        Link: 'https://example.com/job1', // Duplicate link
        Source: 'TestSource',
        Snippet: 'CIO Duplicate from TestSource'
      }
    ];

    // Test processJobs
    const processedJobs = processJobs(mockJobs, mockFilters, mockConfig);
    console.log('processJobs test:', JSON.stringify(processedJobs, null, 2));
    if (processedJobs.length !== 2) {
      throw new Error(`Expected 2 jobs after deduplication, got ${processedJobs.length}`);
    }
    if (processedJobs[0].Score !== 14 || processedJobs[0].Status !== 'New') {
      throw new Error(`Job 1 score/status incorrect: ${processedJobs[0].Score}, ${processedJobs[0].Status}`);
    }
    if (processedJobs[1].Score !== -10 || processedJobs[1].Status !== 'Ignore') {
      throw new Error(`Job 2 score/status incorrect: ${processedJobs[1].Score}, ${processedJobs[1].Status}`);
    }
    if (processedJobs.some(job => !job.MatchedKeywords || !job.Snippet.includes('from TestSource'))) {
      throw new Error('Job missing MatchedKeywords or incorrect Snippet');
    }

    // Test calculateScore
    const testJob = mockJobs[0];
    const { score, matchedKeywords } = calculateScore(testJob, mockFilters);
    console.log('calculateScore test:', { score, matchedKeywords });
    if (score !== 14 || matchedKeywords.length !== 2 || !matchedKeywords.includes('CIO') || !matchedKeywords.includes('Remote')) {
      throw new Error('calculateScore failed: incorrect score or keywords');
    }

    logMessage('INFO', 'output.testOutput', 'Test Completed', 'All output tests passed');
  } catch (error) {
    logMessage('ERROR', 'output.testOutput', 'Test Failed', `Test failed: ${error.message}`);
    throw error;
  }
}