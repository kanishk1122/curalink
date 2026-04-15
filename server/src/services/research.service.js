const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Service to handle retrieval from PubMed, OpenAlex, and ClinicalTrials.gov
 */
class ResearchService {
  constructor() {
    this.pubmedBaseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    this.openAlexBaseUrl = 'https://api.openalex.org/works';
    this.clinicalTrialsBaseUrl = 'https://clinicaltrials.gov/api/v2/studies';
    this.ncbiApiKey = process.env.NCBI_API_KEY;
  }

  /**
   * Fetch publications from PubMed
   * REFINED: Removed restrictive geographic filtering for academic sources.
   * Academic research is better searched globally to ensure data depth.
   */
  async fetchPubMed(query, location = '', maxResults = 100) {
    try {
      // Use the query as provided (expanded by AI). We no longer force 'AND (Location)' here.
      const searchUrl = `${this.pubmedBaseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&sort=pub+date&retmode=json${this.ncbiApiKey ? `&api_key=${this.ncbiApiKey}` : ''}`;
      console.log(`[ResearchService] Fetching PubMed: ${searchUrl}`);
      const searchResponse = await axios.get(searchUrl, { timeout: 10000 });
      const ids = searchResponse.data.esearchresult.idlist;

      if (!ids || ids.length === 0) {
        console.log(`[ResearchService] PubMed 0 results for: ${query}`);
        return [];
      }

      const summaryUrl = `${this.pubmedBaseUrl}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${this.ncbiApiKey ? `&api_key=${this.ncbiApiKey}` : ''}`;
      const summaryResponse = await axios.get(summaryUrl);
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
          location: '' // Global result, ranking engine will try to match affiliations later
        };
      });
    } catch (error) {
      console.error('PubMed Fetch Error Structure:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data
      });
      return [];
    }
  }

  /**
   * Fetch publications from OpenAlex
   * REFINED: Removed restrictive geographic filtering.
   */
  async fetchOpenAlex(query, location = '', maxResults = 100) {
    try {
      const url = `${this.openAlexBaseUrl}?search=${encodeURIComponent(query)}&per-page=${maxResults}&sort=relevance_score:desc`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Curalink/1.0 (mailto:kansihk12soni@gmail.com)' }
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
   * KEEPING: Geographic filtering is legitimate for clinical trials as they are location-bound.
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

      const response = await axios.get(url, { timeout: 8000 });
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
      
      // Location Affinity (Soft Match)
      // Check title, snippet, and location field for matches to the user's focus area
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

    // Diversity slots: ensure at least up to 4 trials and 4 papers if available
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
