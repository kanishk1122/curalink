const axios = require('axios');

async function testOpenAlex() {
  const query = 'Tetanus';
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5&sort=relevance_score:desc`;
  console.log(`Testing URL: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Curalink/1.0 (mailto:kansihk12soni@gmail.com)' }
    });
    
    console.log('Success!');
    console.log(`Count: ${response.data.results.length}`);
    if (response.data.results.length > 0) {
      console.log('First result title:', response.data.results[0].display_name);
    } else {
      console.log('No results found.');
      console.log('Full response metadata:', response.data.meta);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testOpenAlex();
