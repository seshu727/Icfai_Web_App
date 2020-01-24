describe('Protractor Typescript Demo', function () {

    browser.ignoreSynchronization = true; // for non-angular websites
    it('first test', function () {


        browser.get("http://facebook.com")
        browser.manage().window().maximize();
        

    });
    it('second test', function () {


        browser.get("http://facebook.com")
        browser.manage().window().maximize();
        

    });
});