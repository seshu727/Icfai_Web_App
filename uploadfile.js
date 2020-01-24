describe('Protractor Typescript Demo', function () {

    browser.waitForAngularEnabled(false); // for non-angular websites
    it('login functionality', function () {
        browser.get('http://v3icfai.zeroco.de');
        browser.manage().timeouts().implicitlyWait(20000);
        //browser.sleep(10000);
        element(by.xpath('//input[@id="appUserName"]')).sendKeys('itadmin');
        //browser.sleep(1000);
        element(by.id('appPassword')).sendKeys('The@1234');
        //browser.sleep(1000);
        element(by.id('loginBtn')).click();
        var text = element(by.xpath('//span[@class="welcome"]'));
        expect(text.isDisplayed()).toBe(true);
      
      });
        it('uploading a file', function () {
        //browser;
        element(by.xpath('//div[@id="mat-tab-label-0-1"]')).click();
       // browser.sleep(1000);
        element(by.xpath('//tbody[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/zc-actions[1]/div[1]/div[1]/div[1]/div[1]/i[1]')).click();
       // browser.sleep(1000);
        element(by.xpath('//tbody[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/zc-actions[1]/div[1]/div[1]/div[1]/div[1]/div[1]/button[3]')).click();
       // browser.sleep(1000);
       element(by.xpath('//a[@class="btn btn-outline-primary"]')).click();
       
       browser.executeScript('window.scrollTo(0,300);').then(function() {
         });
        //browser.sleep(3000);
        var path = require('path'),
        uploadInput = element(by.xpath("//div[@class='custom-file ng-star-inserted']")),
        fileToUpload = './basictemp.xlsx',
        //var fileToUpload = './jpegg.jpeg',
        fileToUpload1= './exceldata.xlsx',
        
        absolutePath = path.resolve(__dirname, fileToUpload);
        browser.sleep(30000);
        absolutePath1 = path.resolve(__dirname, fileToUpload1);
        
        browser.sleep(30000);
       
        uploadInput.sendKeys(absolutePath + "\n" + absolutePath1);
        
         browser.sleep(30000);
          var foo = element(by.xpath('//span[contains(text(),"xlsxxx.xlsx")]'));
         expect(foo.isDisplayed()).toBe(false);
         console.log("success");

        
         element(by.id('updateItem')).click();
         element(by.id('createClassPlan')).click();
         //browser.sleep(10000);
         console.log("screenshot taken")
        });
    });