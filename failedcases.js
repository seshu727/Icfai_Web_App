describe('Protractor Typescript Demo', function () {

    browser.ignoreSynchronization = true;
    var HtmlScreenshotReporter = require('protractor-jasmine2-screenshot-reporter');
    var reporter = new HtmlScreenshotReporter({
        dest: 'target/screenshots',
        filename: 'my-report.html',
        captureOnlyFailedSpecs: true
    });
    it('Excel File Operations', function () {
        browser.get("http://google.com");
        browser.manage().window().maximize();
        browser.getTitle().then(function(title) {
            console.log(title)

            expect(title).toEqual('Google1');

            //console.log(title)
        });
    });
});