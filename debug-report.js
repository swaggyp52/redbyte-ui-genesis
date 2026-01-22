
const fs = require('fs');
try {
    let content = fs.readFileSync('report.json', 'utf16le');
    const jsonStart = content.indexOf('{');
    if (jsonStart > -1) content = content.slice(jsonStart);

    const report = JSON.parse(content);
    let errorLog = '';

    const iterate = (suite) => {
        if (suite.specs) {
            suite.specs.forEach(spec => {
                if (spec.tests) {
                    spec.tests.forEach(test => {
                        if (test.results) {
                            test.results.forEach(result => {
                                if (result.error) {
                                    errorLog += `Error in ${spec.title}:\n`;
                                    errorLog += result.error.message + '\n';
                                    if (result.error.stack) {
                                        errorLog += 'Stack:\n' + result.error.stack + '\n';
                                    }
                                    errorLog += '-----------------------------------\n';
                                }
                            });
                        }
                    });
                }
            });
        }
        if (suite.suites) suite.suites.forEach(iterate);
    };

    if (report.suites) {
        iterate(report.suites[0]);
    } else {
        errorLog = 'No suites found in report.';
    }

    fs.writeFileSync('error.txt', errorLog, 'utf8');
    console.log('Error log written to error.txt');

} catch (e) {
    console.error(e);
}
