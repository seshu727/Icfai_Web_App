describe('Protractor Typescript Demo', function () {
    var fs = require('fs');

    it('Excel File Operations', function () {

        browser.ignoreSynchronization = true;
        browser.get("http://google.com");
        browser.manage().window().maximize();
            function writeScreenShot(data, filename) {
                var stream = fs.createWriteStream(filename);
                stream.write(new Buffer(data, 'base64'));
                stream.end();
            }
            browser.takeScreenshot().then(function (png) {
                writeScreenShot(png, 'exception.png');
            });

        });
    
    });