// scraper.gs
// Author: Vincent Wachira
// Version: v1.3
// Date: September 13, 2025
// Description: Fetches and parses RSS feeds from sources provided by input.getActiveSources(). Returns raw job objects for processing. Logging aligned with new Logs tab structure (ID, Module, Type, Message). Fixed timeouts and XML errors (v1.1). Updated to support batch processing (v1.2). Ensured valid logMessage parameters to prevent undefined type errors.
// Dependencies: utils.gs (logMessage, formatDate, generateUniqueID), input.gs (getActiveSources), SpreadsheetApp, UrlFetchApp, XmlService
// Assumes: SHEET_ID set in Script Properties; Sources tab has SourceName,URL,Notes,Active; utils.gs v1.3, input.gs v1.2 in place.

/**
 * Scrapes jobs from a subset of RSS feeds (for batch processing)
 * @param {Array<Object>} sources - Array of {SourceName, URL, Notes} from input.getActiveSources
 * @returns {Array<Object>} Array of raw job objects {ID, DateFound, Title, Company, Location, Link, Source, Snippet}
 */
function scrapeJobs(sources) {
  try {
    logMessage('INFO', 'scraper.scrapeJobs', 'Scrape Started', `Starting scrape for ${sources.length} sources`);

    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error('No valid sources provided');
    }

    const jobs = [];
    const today = formatDate(new Date(), 'yyyy-MM-dd');

    for (const source of sources) {
      if (!source.SourceName || !source.URL) {
        logMessage('WARN', 'scraper.scrapeJobs', 'Invalid Source', `Skipping invalid source: ${JSON.stringify(source).substring(0, 100)}`);
        continue;
      }

      logMessage('INFO', 'scraper.scrapeJobs', 'Fetch Started', `Fetching URL: ${source.URL}`);
      try {
        const sourceJobs = fetchSingleRSS(source.URL, source.SourceName, today);
        jobs.push(...sourceJobs);
        logMessage('INFO', 'scraper.scrapeJobs', 'Fetch Completed', `Fetched ${sourceJobs.length} jobs from ${source.SourceName}`);
        Utilities.sleep(1000); // 1s delay between feeds
      } catch (error) {
        logMessage('ERROR', 'scraper.scrapeJobs', 'Fetch Failed', `Failed to fetch ${source.SourceName}: ${error.message}`);
        continue; // Continue to next source
      }
    }

    logMessage('INFO', 'scraper.scrapeJobs', 'Scrape Completed', `Scraped ${jobs.length} total jobs from ${sources.length} sources`);
    return jobs;
  } catch (error) {
    logMessage('ERROR', 'scraper.scrapeJobs', 'Scrape Failed', `Failed to scrape jobs: ${error.message}`);
    throw error;
  }
}

/**
 * Fetches and parses a single RSS feed
 * @param {string} url - RSS feed URL
 * @param {string} sourceName - Name of the source
 * @param {string} today - Today's date in yyyy-MM-dd
 * @returns {Array<Object>} Array of job objects
 */
function fetchSingleRSS(url, sourceName, today) {
  try {
    // Validate inputs
    if (!url || !sourceName || !today) {
      throw new Error(`Invalid parameters: url=${url}, sourceName=${sourceName}, today=${today}`);
    }

    // Fetch with timeout (10 seconds)
    let response;
    try {
      response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        timeoutMs: 10000 // Custom timeout (10s)
      });
    } catch (fetchError) {
      throw new Error(`HTTP fetch failed: ${fetchError.message}`);
    }

    if (response.getResponseCode() !== 200) {
      throw new Error(`HTTP error ${response.getResponseCode()}: ${response.getContentText().substring(0, 100)}`);
    }

    // Parse XML
    let xml;
    try {
      xml = XmlService.parse(response.getContentText());
    } catch (parseError) {
      throw new Error(`XML parsing failed: ${parseError.message}`);
    }

    const root = xml.getRootElement();
    const channel = root.getChild('channel');
    if (!channel) {
      throw new Error('No channel found in RSS feed');
    }

    const items = channel.getChildren('item').slice(0, 50); // Limit to 50 items
    const jobs = [];

    for (const item of items) {
      const title = item.getChildText('title') || 'Unknown Title';
      const link = item.getChildText('link') || '';
      const pubDate = item.getChildText('pubDate') || today;
      const description = item.getChildText('description') || '';
      const company = item.getChildText('company') || '';
      const location = item.getChildText('location') || '';

      if (!link) {
        logMessage('WARN', 'scraper.fetchSingleRSS', 'Invalid Item', `Skipping item with no link in ${sourceName}`);
        continue;
      }

      jobs.push({
        ID: generateUniqueID('INFO'),
        DateFound: today,
        Title: title,
        Company: company,
        Location: location,
        Link: link,
        Source: sourceName,
        Snippet: description.substring(0, 500)
      });
    }

    logMessage('INFO', 'scraper.fetchSingleRSS', 'Parse Completed', `Parsed ${jobs.length} jobs from ${sourceName}`);
    return jobs;
  } catch (error) {
    logMessage('ERROR', 'scraper.fetchSingleRSS', 'Fetch Failed', `Failed to fetch ${url}: ${error.message}`);
    throw error;
  }
}

/**
 * Test function for scraper module
 */
function testScraper() {
  try {
    logMessage('INFO', 'scraper.testScraper', 'Test Started', 'Starting scraper tests');

    // Mock sources
    const mockSources = [
      {
        SourceName: 'Mock RSS',
        URL: 'https://example.com/feed',
        Notes: 'Mock feed for testing'
      },
      {
        SourceName: 'Invalid RSS',
        URL: 'https://example.com/invalid-feed',
        Notes: 'Simulates invalid feed'
      },
      {
        SourceName: 'Timeout RSS',
        URL: 'https://example.com/slow-feed',
        Notes: 'Simulates timeout'
      }
    ];

    // Mock UrlFetchApp for testing
    const mockFetch = (url, options) => {
      if (url === 'https://example.com/feed') {
        return {
          getResponseCode: () => 200,
          getContentText: () => `
            <rss version="2.0">
              <channel>
                <item>
                  <title>Test Job</title>
                  <link>https://example.com/job1</link>
                  <pubDate>2025-09-13</pubDate>
                  <description>Test job description</description>
                </item>
              </channel>
            </rss>
          `
        };
      } else if (url === 'https://example.com/invalid-feed') {
        throw new Error('XML parsing failed: Invalid XML structure');
      } else if (url === 'https://example.com/slow-feed') {
        throw new Error('HTTP fetch failed: Request timed out');
      } else {
        throw new Error('Unknown URL');
      }
    };

    UrlFetchApp.fetch = mockFetch;

    // Test scrapeJobs with a single batch
    const jobs = scrapeJobs(mockSources.slice(0, 2)); // Test with 2 sources
    console.log('scrapeJobs test:', JSON.stringify(jobs));
    if (jobs.length !== 1 || !jobs[0].Title.includes('Test Job') || !jobs[0].Link.includes('job1')) {
      throw new Error('scrapeJobs failed: expected 1 job from Mock RSS');
    }

    logMessage('INFO', 'scraper.testScraper', 'Test Completed', 'All scraper tests passed');
  } catch (error) {
    logMessage('ERROR', 'scraper.testScraper', 'Test Failed', `Test failed: ${error.message}`);
    throw error;
  } finally {
    // Restore UrlFetchApp.fetch
    UrlFetchApp.fetch = UrlFetchApp.fetch;
  }
}