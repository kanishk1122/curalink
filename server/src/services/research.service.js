const axios = require('axios');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Service to handle retrieval from PubMed, OpenAlex, and ClinicalTrials.gov
 * HARDENED: Survival Kit for Cloud-based (DigitalOcean) retrieval.
 */
class ResearchService {
  constructor() {
    this.pubmedBaseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    this.openAlexBaseUrl = 'https://api.openalex.org/works';
    this.clinicalTrialsBaseUrl = 'https://clinicaltrials.gov/api/v2/studies';
    this.ncbiApiKey = process.env.NCBI_API_KEY;

    // THE CLEAN AGENT: Natively force IPv4 only
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      timeout: 15000,
      family: 4 
    });

    // Identity headers for medical authority (NCBI Recommended Format)
    this.headers = {
      'User-Agent': 'CuralinkBackend/1.0 (mailto:kanishk21soni@gmail.com)'
    };
  }

  /**
   * Helper for Exponential Backoff Retries
   */
  async _retryRequest(fn, retries = 3, delay = 2000) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNRESET' || 
        error.code === 'ECONNABORTED' ||
        error.code === 'EADDRINUSE' ||
        error.code === 'EPIPE' ||
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('socket hang up');

      if (retries <= 0 || !isRetryable) {
        throw error;
      }
      console.log(`[ResearchService] Request failed (${error.code || error.message}), retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this._retryRequest(fn, retries - 1, delay * 1.5);
    }
  }

  /**
   * Fetch publications from PubMed
   */
  async fetchPubMed(query, location = '', maxResults = 50) { // Reduced to 50 for cloud stability
    try {
      const searchResponse = await this._retryRequest(() =>
        axios.get(`${this.pubmedBaseUrl}/esearch.fcgi`, {
          params: {
            db: 'pubmed',
            term: query,
            retmax: maxResults,
            sort: 'pub+date',
            retmode: 'json',
            ...(this.ncbiApiKey && { api_key: this.ncbiApiKey })
          },
          headers: this.headers,
          httpsAgent: this.httpsAgent,
          timeout: 15000 
        })
      );

      const ids = searchResponse.data.esearchresult.idlist;
      if (!ids || ids.length === 0) return [];

      const summaryResponse = await this._retryRequest(() =>
        axios.get(`${this.pubmedBaseUrl}/esummary.fcgi`, {
          params: {
            db: 'pubmed',
            id: ids.join(','),
            retmode: 'json',
            ...(this.ncbiApiKey && { api_key: this.ncbiApiKey })
          },
          headers: this.headers,
          httpsAgent: this.httpsAgent,
          timeout: 15000
        })
      );

      const results = summaryResponse.data.result;
      return ids.map(id => {
        const item = results[id];
        return {
          title: item.title,
          authors: item.authors?.map(a => a.name).join(', '),
          year: item.pubdate?.split(' ')[0],
          platform: 'PubMed',
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          snippet: item.fulljournalname,
          type: 'Publication',
          location: ''
        };
      });
    } catch (error) {
      console.error('PubMed Restoration Failure:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        query: query.slice(0, 50)
      });
      return [];
    }
  }

  /**
   * Fetch publications from OpenAlex
   */
  async fetchOpenAlex(query, location = '', maxResults = 50) {
    try {
      const url = `${this.openAlexBaseUrl}?search=${encodeURIComponent(query)}&per-page=${maxResults}&sort=relevance_score:desc`;
      const response = await axios.get(url, {
        headers: this.headers,
        httpsAgent: this.httpsAgent,
        timeout: 15000
      });

      return response.data.results.map(work => ({
        title: work.display_name,
        authors: work.authorships?.map(a => a.author.display_name).slice(0, 3).join(', '),
        year: work.publication_year?.toString(),
        platform: 'OpenAlex',
        url: work.doi || work.id,
        snippet: work.abstract_inverted_index ? 'Abstract available' : work.primary_location?.source?.display_name,
        type: 'Publication'
      }));
    } catch (error) {
      console.error(`OpenAlex Fetch Error [Query: ${query}]:`, error.message);
      return [];
    }
  }

  /**
   * Fetch Clinical Trials from ClinicalTrials.gov v2
   */
  async fetchClinicalTrials(condition, location = '', maxResults = 50) {
    try {
      const cleanCondition = condition?.replace(/[^\w\s-]/gi, '').trim();
      if (!cleanCondition || cleanCondition.length < 2) return [];

      let url = `${this.clinicalTrialsBaseUrl}?query.cond=${encodeURIComponent(cleanCondition)}&pageSize=${maxResults}&countTotal=true&format=json`;
      const cleanLocation = location?.replace(/[^\w\s,]/gi, '').trim();

      if (cleanLocation && !['global', 'remote', 'unknown', 'none', 'any', 'worldwide'].includes(cleanLocation.toLowerCase())) {
        url += `&query.locn=${encodeURIComponent(cleanLocation)}`;
      }

      const response = await axios.get(url, {
        headers: this.headers,
        httpsAgent: this.httpsAgent,
        timeout: 15000
      });

      const studies = response.data.studies || [];

      return studies.map(study => {
        const protocol = study.protocolSection;
        const info = protocol.identificationModule;
        const status = protocol.statusModule;
        const locations = protocol.contactsLocationsModule?.locations || [];

        return {
          title: info.officialTitle || info.briefTitle,
          status: status.overallStatus,
          location: locations.length > 0 ? `${locations[0].city}, ${locations[0].country}` : 'Remote/Global',
          platform: 'ClinicalTrials.gov',
          url: `https://clinicaltrials.gov/study/${info.nctId}`,
          snippet: protocol.descriptionModule?.briefSummary || 'No summary available',
          type: 'Trial',
          detailedLocation: locations
        };
      });
    } catch (error) {
      console.error('ClinicalTrials Fetch Error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Final Ranking Pipeline (Source diversity + Recency + Clinical Weight + Soft Location Match)
   */
  rankResults(results, userLocation = '', topK = 8) {
    const currentYear = new Date().getFullYear();
    const locLower = userLocation?.toLowerCase().trim();

    const scoredResults = results.map(res => {
      let score = 0;
      const year = parseInt(res.year) || 0;

      if (year >= currentYear - 1) score += 50;
      else if (year >= currentYear - 3) score += 30;
      else if (year >= currentYear - 5) score += 10;

      if (res.type === 'Trial') {
        score += 30;
        if (res.status === 'RECRUITING') score += 15;
      }

      if (locLower && (
        (res.location && res.location.toLowerCase().includes(locLower)) ||
        (res.title && res.title.toLowerCase().includes(locLower)) ||
        (res.snippet && res.snippet.toLowerCase().includes(locLower))
      )) {
        score += 40;
      }

      return { ...res, score };
    });

    const trials = scoredResults.filter(r => r.type === 'Trial').sort((a, b) => b.score - a.score);
    const papers = scoredResults.filter(r => r.type !== 'Trial').sort((a, b) => b.score - a.score);

    const selected = [];
    const titles = new Set();

    const tryAdd = (item) => {
      if (selected.length >= topK) return false;
      const baseTitle = item.title.toLowerCase().trim().slice(0, 50);
      if (!titles.has(baseTitle)) {
        selected.push(item);
        titles.add(baseTitle);
        return true;
      }
      return false;
    };

    for (let i = 0; i < 4; i++) {
      if (trials[i]) tryAdd(trials[i]);
      if (papers[i]) tryAdd(papers[i]);
    }

    const remaining = [...trials.slice(4), ...papers.slice(4)].sort((a, b) => b.score - a.score);
    for (const item of remaining) {
      if (selected.length >= topK) break;
      tryAdd(item);
    }

    return selected.sort((a, b) => b.score - a.score);
  }
}

module.exports = new ResearchService();
