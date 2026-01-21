const fs = require('fs');
const data = JSON.parse(fs.readFileSync('files-test-results.json', 'utf8'));

console.log('Total tests:', data.numTotalTests);
console.log('Passed:', data.numPassedTests);
console.log('Failed:', data.numFailedTests);
console.log('\nFailed tests:');

data.testResults.forEach(suite => {
    suite.assertionResults.forEach(test => {
        if (test.status === 'failed') {
            console.log('\n---');
            console.log('Test:', test.fullName);
            if (test.failureMessages && test.failureMessages[0]) {
                const lines = test.failureMessages[0].split('\n');
                console.log('Error:', lines[0]);
                console.log('Location:', lines[1]);
            }
        }
    });
});
