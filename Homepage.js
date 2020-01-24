 var icfai = function () {
    //login details
    var entermail = element(by.id('appUserName'));
    var enterpass = element(by.id('appPassword'));
    var clickbutton = element(by.id('loginBtn'));
    //waits and page maximize
    var waitts = browser.manage().timeouts().implicitlyWait(10000);
    var maxi = browser.manage().window().maximize();
    //loaction
    var clickonmasters = element(by.xpath('//div[1]/zc-com-render[1]/div[1]/zc-menu[1]/ul[1]/li[2]/a[1]/span[2]'));
    var clickonlocation = element(by.xpath('//span[contains(text(),"Location")]'));
    var locationname = element(by.xpath('//input[@id="name"]'));
    var loactioncode = element(by.xpath('//input[@id="code"]'));
    var locationtag = element(by.xpath('//input[@id="tags"]'));
    var locationreset = element(by.xpath('//button[@id="resetBtn"]'));
    var locationsubmit = element(by.xpath("//button[@id='submitBtn']"));
    var locationtext = element(by.xpath('//h3[@class="ng-star-inserted"]'));
    var locsearchbox = element(by.xpath('//zc-data-list-filter[1]/div[2]/div[1]/div[1]/div[1]/div[1]/input[1]'))
    var searchbtn = element(by.xpath('//zc-data-list-filter[1]/div[2]/div[2]/div[1]/div[1]/button[1]'))
    //batch
    var clickonbatch = element(by.xpath('//div[1]/zc-menu[1]/ul[1]/li[2]/ul[1]/li[4]/a[1]/span[1]'));
    var batchname = element(by.xpath('//input[@id="name"]'));
    var batchcode = element(by.xpath('//input[@id="code"]'));
    var batchtag = element(by.xpath('//div[1]/zc-form[1]/div[1]/form[1]/formly-form[1]/formly-field[3]/formly-wrapper-form-field[1]/div[1]/div[1]/zc-text[1]/input[1]'));
    var batchresetbtn = element(by.xpath('//button[@id="resetBtn"]'));
    var batchsubmitbtn = element(by.xpath('//button[@id="submitBtn"]'));
    var batchsearchbox = element(by.className("ng-untouched ng-pristine ng-valid"));
    var batchsearchbtn = element(by.xpath('//zc-data-list-filter[1]/div[2]/div[2]/div[1]/div[1]/button[1]'));
    var batchtable = element.all(by.xpath('//div[1]/div[1]/table[1]'));
    var deletebtn = element(by.xpath('//tr[1]/td[4]/zc-actions[1]/div[1]/i[2]'));
    var popupbtn = element(by.xpath('//div[1]/div[1]/zc-dialog[1]/div[1]/div[2]/button[1]'));
    var batcheditbtn = element(by.xpath('//tr[1]/td[4]/zc-actions[1]/div[1]/i[1]'));
    var updatetext = element(by.xpath('//div[1]/zc-form[1]/div[1]/h3[1]'))
    var refreshbtn = element(by.xpath('//div[1]/p-paginator[1]/div[1]/div[1]/a[1]'))
    var deletebtntext = element(by.xpath('//div[1]/zc-dialog[1]/div[1]/div[1]'))
    //batch subject
    var clickonbatchsubject = element(by.xpath('//ul[1]/li[2]/ul[1]/li[5]/a[1]/span[1]'));
    var clickondownbutton = element(by.xpath("//zc-select[1]/div[1]/p-dropdown[1]/div[1]/div[3]"));
    var selectbatch = element(by.xpath("//span[contains(text(),'MBA 1992-94')]"));
    var selectsubject = element(by.xpath('//form[1]/formly-form[1]/formly-field[2]/formly-wrapper-form-field[1]/div[1]/div[1]/zc-text[1]/input[1]'));
    var selectcode = element(by.xpath('//input[@id="code"]'));
    var clickonResetButton = element(by.xpath("//button[@id='resetBtn']"));
    var clickonSubmit = element(by.xpath("//button[@id='submitBtn']"));
    var searchbox1=element(by.xpath('//zc-data-list-filter[1]/div[2]/div[2]/div[1]/div[1]/div[1]/input[1]'));
    var searchbtn1=element(by.xpath('//zc-data-list-filter[1]/div[2]/div[3]/div[1]/div[1]/button[1]'))
    var selectbatch1= element(by.xpath('//span[contains(text(),"MBA 1992-94")]'))

    //subject chapter
    var clickdwnbtn = element(by.xpath('//zc-select[1]/div[1]/p-dropdown[1]/div[1]/div[3]'));
    var clickonsubject = element(by.xpath("//div[2]/ul[1]/li[1]/span[1]"));
    var subjectchapter1 = element(by.xpath("//textarea[@id='name']"));
    var code = element(by.xpath('//input[@id="code"]'));
    var CresetButton = element(by.xpath('//button[@id="resetBtn"]'));
    var Csubmit = element(by.xpath('//button[@id="submitBtn"]'));
    var clickonsubjectchapter = element(by.xpath('//div[1]/div[1]/zc-com-render[1]/div[1]/zc-menu[1]/ul[1]/li[2]/ul[1]/li[6]/a[1]/span[1]'));
    //var clickonsubject1=element(by.xpath('/html[1]/body[1]/div[4]/div[2]/ul[1]/li[2]/span[1]'))
    var clickoneditbtnSC = element(by.xpath('//zc-actions[1]/div[1]/i[1]'));
    //faculty creation 
    var clickonfaculty = element(by.xpath('//a[@class="nav-link ng-star-inserted"]//span[contains(text(),"Faculty")]'));
    var schedulecalss1 = element(by.xpath('//div[1]/div[2]/zc-com-render[1]/div[1]/zc-form[1]/div[1]/h3[1]'));
    var fname = element(by.xpath('//input[@id="first_name"]'));
    var fmail = element(by.xpath('//input[@id="email"]'));
    var fmobile = element(by.xpath('//input[@id="contact_no"]'));
    var fpass = element(by.xpath('//input[@id="password"]'));
    var clickonaddbtn = element(by.xpath('//a[@class="btn btn-outline-primary"]'));
    var clickondownbt = element(by.xpath('//div[@class="ui-dropdown-trigger ui-state-default ui-corner-right"]'));
    var batchselection = element(by.xpath('//span[contains(text(),"MBA 1992-94")]'));
    var facutlydownbtn = element(by.xpath("//zc-select[1]/div[1]/p-multiselect[1]/div[1]/div[3]"));
    var fclickoncheckbox = element(by.xpath('//p-multiselectitem[1]/li[1]/div[1]/div[1]'));
    var fclickoncheckbox1 = element(by.xpath('//html[1]/body[1]/div[4]/div[2]/ul[1]/p-multiselectitem[2]/li[1]'));
    var fcrossbtn = element(by.xpath('//a[@class="ui-multiselect-close ui-corner-all"]'));
    var fsubmitbtn = element(by.xpath('//formly-field[3]/formly-group[1]/formly-field[1]/formly-wrapper-form-field[1]/div[1]/div[1]/zc-button[1]/div[1]/button[1]'));
    var fsubmitbtn1 = element(by.xpath('//formly-group[1]/formly-field[1]/formly-wrapper-form-field[1]/div[1]/div[1]/zc-button[1]/div[1]/button[1]'));
    var facultyresetbtn = element(by.xpath('//formly-group[1]/formly-field[2]/formly-wrapper-form-field[1]/div[1]/div[1]/zc-button[1]/div[1]/button[1]'));
    var textintable = element(by.xpath("//formly-field[5]/formly-wrapper-form-field[1]/div[1]/div[1]/zc-zc-table[1]/div[2]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[2]"));
    var mailnphonenumber = element(by.xpath("//div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[2]/div[1]"));
    var facultydwnbtn = element(by.xpath("//div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/a[1]"));
    //faculty updation
    var clickonedit = element(by.xpath('//div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1]'));
    var clickoneditbtn = element(by.xpath('//a[@class="icon-edit p-1 ng-star-inserted"]'));
    var clickondownbtn = element(by.xpath('//div[@class="ui-dropdown-trigger ui-state-default ui-corner-right"]'));
    var selectbatch1 = element(by.xpath('/html[1]/body[1]/div[3]/div[2]/ul[1]/li[2]'));
    var selectdownbtn = element(by.xpath('//formly-form[1]/formly-field[2]/formly-wrapper-form-field[1]/div[1]/div[1]/zc-select[1]/div[1]/p-multiselect[1]/div[1]/div[3]'));
    var selectcheckbox = element(by.xpath('//p-multiselectitem[1]/li[1]/div[1]/div[1]'));
    var clickoncross = element(by.xpath('//a[@class="ui-multiselect-close ui-corner-all"]'));
    var fsubmit = element(by.xpath('//button[@id="updateBtn"]'));
    var ffsubmit = element(by.xpath('//button[@id="submitBtn"]'));

    this.get = function () {
        browser.get('http://v3icfai.zeroco.de');
    };

    this.getMax = function () {
        return maxi;
    };

    this.wait = function () {
        return waitts;
    };
    this.loginpage = function () {
        browser.sleep(5000)
        entermail.sendKeys("itadmin");
        enterpass.sendKeys("The@1234");
        clickbutton.click();
        browser.sleep(10000)

        schedulecalss1.getText().then(function (message) {
            console.log(message);
            if (expect(message).toString("Schedule a Class")) {
                console.log("Login success")

            } else {
                console.log("Login failed")
            }
        });
    }
    this.facultycreation = function () {
       // clickonmasters.click()
        browser.sleep(10000)
        clickonfaculty.click();
        browser.sleep(10000)
        fname.sendKeys("test8");
        fmail.sendKeys("ttt@gmail.com");
        fmobile.sendKeys("7700990099");
        fpass.sendKeys("The@1234");
        clickonaddbtn.click();
        clickondownbt.click();
        browser.sleep(10000);
        batchselection.click();
        browser.sleep(10000);
        facutlydownbtn.click();
        browser.sleep(10000);
        fclickoncheckbox.click();
        browser.sleep(10000);
        fcrossbtn.click();
        browser.sleep(20000);
        fsubmitbtn.click();
        browser.sleep(20000);
        browser.executeScript('window.scrollTo(0,10000);').then(function () {
            console.log('scrolled Up');

        })
        fsubmitbtn1.click();
        browser.sleep(10000);

        element.all(by.css("td")).getText().then(function (cols) {
            console.log(cols);

            if (expect(cols).toString('test8')) {
                console.log(" found in faculty list");
            }
            else {
                console.log("not found in faculty list")
            }

        });
    };
    this.Facultyupdation = function () {
        browser.executeScript('window.scrollTo(0,0);').then(function () {
            console.log('scrolled Up');
        });
        browser.sleep(10000);

        clickonedit.click();
        browser.sleep(10000)
        fname.clear();
        fname.sendKeys('test500');
        fmail.clear();
        fmail.sendKeys("yoooo1651232@gmail.com");
        fmobile.clear();
        fmobile.sendKeys('3458728810');
        browser.executeScript('window.scrollTo(0,10000);').then(function () {
            console.log('scrolled Down');

        });
        clickoneditbtn.click();
        browser.sleep(5000)
        selectdownbtn.click();
        browser.sleep(20000);
        fclickoncheckbox1.click();
        browser.sleep(20000);
        clickoncross.click();
        browser.sleep(10000);
        fsubmit.click();
        browser.sleep(10000);
        ffsubmit.click();
        textintable.getText().then(function (textoftable) {
            console.log(textoftable);

            if (expect(textoftable).toString('Marktingtest10')) {
                console.log(" Updated data found in table");
            }
            else {
                console.log("Updated data not  found in table")
            }

        });
    }

    this.loaction1 = function () {
        clickonmasters.click();
        browser.sleep(10000)
        clickonlocation.click();
        locationtext.getText().then(function (textoflocation) {
            console.log(textoflocation);
            if (expect(textoflocation).toString("Add Location")) {
                console.log("same text ")
            } else {
                console.log("not same ")
            }
        });
        locationname.sendKeys("Classy");
        loactioncode.sendKeys("143");
        locationtag.sendKeys("srnagar");
        locationreset.click();
        locationname.sendKeys("Classy");
        loactioncode.sendKeys("143");
        locationtag.sendKeys("srnagar");
        locationsubmit.click();
        browser.sleep(1000)
        locsearchbox.sendKeys('Classy');
        browser.sleep(1000)
        searchbtn.click();
        browser.sleep(1000)
        batchtable.get(0).getText().then(function (batchtabledata) {

            console.log(batchtabledata);
            console.log("batch subject added successfully after updation data")
        });

    };

    this.batch = function () {
              browser.sleep(10000)
        console.log("batch started")
        browser.sleep(2000)
        clickonbatch.click();
        browser.sleep(2000)
        batchname.sendKeys("MBA 1992-93");
        browser.sleep(2000)
        batchcode.sendKeys("20");
        browser.sleep(2000)
        batchtag.sendKeys("fresh1");
        batchresetbtn.click();
        console.log("Reset done")
        batchname.sendKeys("MBA 1992-93");
        batchcode.sendKeys("20");
        batchtag.sendKeys("fresh1");
        batchsubmitbtn.click();
        
        batchtable.get(0).getText().then(function (batchtabledata) {

            console.log(batchtabledata);
            console.log("batch created successfully before updation")
        });

        browser.sleep(10000)
        refreshbtn.click();
        browser.sleep(5000)
        batcheditbtn.click();
        
        batchname.clear();
        batchname.sendKeys("MBA 1992-94");
        batchcode.clear();
        batchcode.sendKeys("21");
        batchtag.clear()
        batchtag.sendKeys("fresh");
        batchsubmitbtn.click();
        browser.sleep(5000)
        batchsearchbox.sendKeys("MBA 1992-94");
        browser.sleep(10000)
        batchsearchbtn.click();
        browser.sleep(10000)
        batchtable.get(0).getText().then(function (batchtabledata) {

            console.log(batchtabledata);
            console.log("batch created successfully after updation")
        });
        batchtable.isDisplayed().then(function (isVisible) {
            if (isVisible) {
                console.log("data found in table")
            } else {
                console.log(" data not found in table")
            }
           
        });

        //deletebtn.click();
       /* deletebtntext.getText().then(function (popuptext) {
        console.log("delete button popuptext   " + popuptext)
        browser.sleep(3000)
        popupbtn.click();
        browser.sleep(10000)
        refreshbtn.click();
    
        browser.sleep(5000)
         })
       
        batchtable.get(0).getText().then(function (batchtabledata) {

        console.log(batchtabledata);
        console.log("data after clicking on  delete button");
         })*/
        batchname.sendKeys("MBA 1992-94");
        batchcode.sendKeys("21");
        batchtag.sendKeys("fresh");
        batchsubmitbtn.click();

    }

    this.batchsubject = function () {
      //  clickonmasters.click()
   
            browser.sleep(10000)
        clickonbatchsubject.click();
        browser.sleep(10000)
        clickondownbutton.click();
        browser.sleep(10000)
        selectbatch.click();
        browser.sleep(5000)
        selectsubject.sendKeys('Google Addwords');
        selectcode.sendKeys("001");
        clickonResetButton.click();
        console.log("reset done")
        clickondownbutton.click();
        selectbatch.click();  
        selectsubject.sendKeys('Google Addwords');
        selectcode.sendKeys("001");
        clickonSubmit.click();

        batchtable.get(0).getText().then(function (batchtabledata) {
            console.log(batchtabledata);
            console.log("batch subject added successfully before updation data")
        })
        browser.sleep(10000)
        refreshbtn.click();
        console.log("page got refreshed")
        browser.sleep(5000)
        batcheditbtn.click();
        browser.sleep(5000)
        clickondownbutton.click();
        browser.sleep(5000)
        selectbatch.click();
        browser.sleep(5000)
        selectsubject.clear()
        selectsubject.sendKeys('Google SEO');
        selectcode.clear()
        selectcode.sendKeys("002");
        clickonSubmit.click();
        browser.sleep(10000)
        searchbox1.sendKeys("Google SEO");
        browser.sleep(10000)
        searchbtn1.click();
        browser.sleep(10000)

        batchtable.get(0).getText().then(function (batchtabledata) {

            console.log(batchtabledata);
            console.log("batch subject added successfully after updation data")
        });
        /*deletebtn.click();
        deletebtntext.getText().then(function (popuptext) {
         console.log("delete button popuptext   " + popuptext)
     })
         browser.sleep(3000)
         popupbtn.click();
         browser.sleep(10000)
         refreshbtn.click();
         
        browser.sleep(5000)
        batchtable.get(0).getText().then(function (batchtabledata) {

        console.log(batchtabledata);
        console.log("data after clicking on  delete button");
        })*/
       

    }
    
    this.subjectChapter = function () {
      //  clickonmasters.click()
        browser.sleep(1000)
        clickonsubjectchapter.click()
        clickdwnbtn.click();
        browser.sleep(1000)
        clickonsubject.click();
        browser.sleep(1000)
        subjectchapter1.sendKeys("introduction");
        browser.sleep(1000)
        code.sendKeys("123");
        browser.sleep(1000)
        CresetButton.click();
        browser.sleep(1000)
        clickdwnbtn.click();
        browser.sleep(1000)
        clickonsubject.click();
        browser.sleep(1000)
        subjectchapter1.sendKeys("introduction");
        browser.sleep(1000)
        code.sendKeys("123");
        browser.sleep(1000)
        Csubmit.click();
        browser.sleep(10000)
        batchtable.get(0).getText().then(function (batchtabledata) {

            console.log(batchtabledata);
            console.log("subject added successfully before updation data")
        });
        browser.sleep(10000)
        clickoneditbtnSC.click();
        browser.sleep(10000)
        clickdwnbtn.click(); 
        browser.sleep(10000)
        clickonsubject.click();
        browser.sleep(10000)
        subjectchapter1.clear()
        subjectchapter1.sendKeys("introductionofmarketing");
        code.clear()
        code.sendKeys("124");
        Csubmit.click();
        batchtable.get(0).getText().then(function (batchtabledata) {

            console.log(batchtabledata);
            console.log("subject added successfully afer updation data")
        });
        clickdwnbtn.click(); 
        browser.sleep(1000)
        clickonsubject.click();
        browser.sleep(1000)
        subjectchapter1.clear()
        subjectchapter1.sendKeys("introductionofmarketing");
        code.clear()
        code.sendKeys("124");
        Csubmit.click();

    };


};


module.exports = icfai
