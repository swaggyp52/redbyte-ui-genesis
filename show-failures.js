const fs = require('fs');
const data = JSON.parse(fs.readFileSync('files-test-results.json', 'utf8'));

const failed = data.testResults[0].assertionResults.filter(t => t.status === 'failed');

failed.forEach(test => {
    console.log('\n========================================');
    console.log('TEST:', test.title);
    console.log('========================================');
    const lines = test.failureMessages[0].split('\n');
    lines.slice(0, 10).forEach(line => console.log(line));
    console.log('');
});
