describe('Protractor Typescript Demo', function () {

    browser.ignoreSynchronization = true; // for non-angular websites
    it('Excel File Operations', function () {

        browser.get('http://icfai.zeroco.de');
        browser.manage().timeouts().implicitlyWait(20000);
        //browser.sleep(10000);
        element(by.xpath('//input[@id="appUserName"]')).sendKeys('pseshu350@gmail.com');
        //browser.sleep(1000);
        element(by.id('appPassword')).sendKeys('The@1234');
        //browser.sleep(1000);
        element(by.id('loginBtn')).click();
        var text = element(by.xpath('//span[@class="welcome"]'));
        expect(text.isDisplayed()).toBe(true);

        element(by.xpath('//div[1]/div[1]/zc-date[1]/div[1]/i[1]')).click();
        browser.sleep(10000);
        element(by.xpath('/html[1]/body[1]/bs-datepicker-container[1]/div[1]/div[1]/div[1]/div[1]/bs-days-calendar-view[1]/bs-calendar-layout[1]/div[2]/table[1]/tbody[1]/tr[5]/td[4]')).click();
        browser.sleep(1000);

           //var datetext = element(by.xpath('//input[@placeholder="DD MMM YYYY"]')).getAttribute('value').then(function() {
            //console.log(datetext);
    });
});

