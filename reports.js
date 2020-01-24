describe('Protractor Typescript Demo', function () {
    var fs = require('fs');

    it('Excel File Operations', function () {
        // browser.ignoreSychronization = true;
        browser.waitForAngularEnabled(false);

        browser.get('http://google.com');
        browser.manage().window().maximize();
        var title = browser.getTitle();
        console.log(title);
        expect(title).toEqual('Google');


    });
    it('Excel File Operations', function () {
        var ele= element(by.name('q'));
        ele.sendKeys('threshold software');
        browser.sleep(10000);
        ele.sendKeys(protractor.Key.ENTER);

       //element(by.className('gNO89b')).click();
        element(by.xpath('/html[1]/body[1]/div[7]/div[3]/div[10]/div[1]/div[2]/div[1]/div[2]/div[2]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/a[1]/h3[1]/div[1]')).click();

        var url = browser.getCurrentUrl();
        expect(url).toContain('https://www.glassdoor.co.in/Reviews/Threshold-Reviews-E1097916.htm');



    });

});