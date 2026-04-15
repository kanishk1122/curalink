const axios = require('axios');

async function testCT() {
  const baseUrl = 'https://clinicaltrials.gov/api/v2/studies';
  const condition = 'Tetanus';

  const urls = [
    // 1. Basic condition search (this one already worked)
    `${baseUrl}?query.cond=${encodeURIComponent(condition)}&pageSize=5&format=json`,

    // 2. Fixed location search — use query.locn (not query.locl)
    `${baseUrl}?query.cond=${encodeURIComponent(condition)}&query.locn=${encodeURIComponent('Global')}&pageSize=5&format=json`,

    // 3. Get only the count (no studies array) — use countTotal=true
    `${baseUrl}?query.cond=${encodeURIComponent(condition)}&countTotal=true&pageSize=1&format=json`,
  ];

  for (const url of urls) {
    console.log(`Testing URL: ${url}`);
    try {
      const resp = await axios.get(url);
      const data = resp.data;

      console.log(`Success!`);
      console.log(`  Studies returned: ${data.studies?.length || 0}`);
      console.log(`  Total count: ${data.totalCount !== undefined ? data.totalCount : 'Not requested'}`);
      console.log('');
    } catch (err) {
      console.log(`Failed with status ${err.response?.status}: ${err.message}`);
      if (err.response?.data) {
        console.log(`Error details:`, JSON.stringify(err.response.data, null, 2));
      }
      console.log('');
    }
  }
}

testCT();