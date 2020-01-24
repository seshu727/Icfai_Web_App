describe('icfai 1st test',function(){
    var h =require('./home.js');
    it('basic test',function(){
        browser.manage().timeouts().implicitlyWait(50000)
        browser.manage().window().maximize();
      //h.waitss();
      //h.maxi();
      h.uname("pseshu350@gmail.com");
      h.upass("The@1234");
      h.clickonbtn();



    });

});

