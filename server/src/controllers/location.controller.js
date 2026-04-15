const fs = require('fs');
const path = require('path');

// Load countries data once into memory for high performance
let countriesData = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, '../data/countries.json'), 'utf8');
  countriesData = JSON.parse(raw);
  console.log(`[LocationService] Successfully ingested ${countriesData.length} global entities.`);
} catch (error) {
  console.error('[LocationService] Failed to load spatial data:', error);
}

/**
 * Get all countries (optimized payload)
 */
const getCountries = async (req, res) => {
  try {
    const countries = countriesData.map(c => ({
      name: c.name,
      code: c.code2
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(countries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve country data' });
  }
};

/**
 * Get states/regions for a specific country
 */
const getStates = async (req, res) => {
  const { code } = req.params;
  try {
    const country = countriesData.find(c => c.code2 === code.toUpperCase());
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const states = (country.states || []).map(s => ({
      name: s.name,
      code: s.code
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json(states);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve state data' });
  }
};

module.exports = {
  getCountries,
  getStates
};
