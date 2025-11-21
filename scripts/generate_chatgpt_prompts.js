#!/usr/bin/env node

/**
 * Generate ChatGPT Prompts for Individual Vendor Evaluation
 */

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'data', 'chatgpt_prompts');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Vendor validation sources
const vendors = [
  { name: 'INRIX', categories: ['Travel Time & Speed', 'Origin-Destination', 'Freight', 'Waypoint', 'Volume', 'Conflation'] },
  { name: 'HERE Technologies', categories: ['Travel Time & Speed'] },
  { name: 'TomTom', categories: ['Travel Time & Speed'] },
  { name: 'StreetLight Data', categories: ['Origin-Destination', 'Volume'] },
  { name: 'Geotab', categories: ['Origin-Destination', 'Freight', 'Volume'] },
  { name: 'AirSage', categories: ['Origin-Destination'] },
  { name: 'Iteris', categories: ['Travel Time & Speed', 'Volume'] },
  { name: 'Quetica', categories: ['Freight'] },
  { name: '1Spatial', categories: ['Conflation', 'Analytics'] },
  { name: 'CARTO', categories: ['Analytics', 'Visualization'] },
  { name: 'Stellar', categories: ['Travel Time & Speed', 'Traffic Management'] }
];

console.log('📝 Generating vendor evaluation prompt templates...\n');

vendors.forEach(vendor => {
  const content = `# ChatGPT Evaluation Prompt: ${vendor.name}

Use the master DQI framework to evaluate ${vendor.name}.

**Data Categories:** ${vendor.categories.join(', ')}

**Instructions:**
1. Review all available TETC validation reports
2. Extract quantitative metrics
3. Apply DQI scoring rubrics
4. Output JSON format with scores

**Start your evaluation now.**
`;
  
  const filename = `${vendor.name.toLowerCase().replace(/\s+/g, '_')}_evaluation.txt`;
  fs.writeFileSync(path.join(outputDir, filename), content);
  console.log(`✅ ${vendor.name}`);
});

console.log(`\n✨ Generated ${vendors.length} prompts in ${outputDir}\n`);
