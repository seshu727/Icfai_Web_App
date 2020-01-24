var login= function() {
        
    this.uname = function (username) {
        element(by.xpath('//input[@id="appUserName"]')).sendKeys(username);
    };
    this.upass = function (upass1) {
        element(by.xpath('//input[@id="appPassword"]')).sendKeys(upass1);
    };
this.clickonbtn =function(){

    element(by.buttonText('Login')).click();

};
//this.waitss=function(){
   // browser.manage().timeouts().implicitlyWait(600000);
//};
//this.maxi =function(){

   // browser.manage().window().maximize();
//};

};
Module.exports =    new login();