const fs = require('fs');
const data = JSON.parse(fs.readFileSync('toolchain-test-results2.json', 'utf8'));
data.testResults[0].assertionResults.forEach(t => {
    console.log('\n' + t.title + ':');
    if (t.failureMessages && t.failureMessages[0]) {
        console.log(t.failureMessages[0].split('\n').slice(0, 2).join('\n'));
    }
});
