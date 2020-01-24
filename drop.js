describe('dropdown ', function () {
    browser.ignoreSynchronization = true;

    it('dropdown test 1', function () {
        browser.manage().timeouts().implicitlyWait(30000);
        browser.manage().window().maximize();
        browser.get("http://icfai.zeroco.de/#/zcbase");
       
        element(by.xpath('//input[@id="appUserName"]')).sendKeys('itadmin');
        //browser.sleep(1000);
        element(by.id('appPassword')).sendKeys('The@1234');
        //browser.sleep(1000);
        element(by.id('loginBtn')).click();

        element(by.xpath('//span[contains(text(),"Masters")]')).click();
        element(by.xpath('//a[@class="nav-link ng-star-inserted active"]//span[contains(text(),"Class Room")]')).click();
        element(by.xpath('//label[@class="ng-tns-c14-60 ui-dropdown-label ui-inputtext ui-corner-all ui-placeholder ng-star-inserted"]')).click();  
        element.all(by.xpath('//select[@id="formly_3_select_meeting_0"]')).then(function (selectItem) {
            expect(selectItem[0].getText()).toEqual('8746480759')
            browser.sleep(5000);
            selectItem[0].click();
            browser.sleep(5000);
            selectItem[3].click();
            browser.sleep(5000);


        });
    });
});