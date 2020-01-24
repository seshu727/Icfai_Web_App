describe('admin login functionality', function () {
    var Homepage1  = new ic();
    it('admin login', function () {

        var path = require('path'),
        uploadInput = element(by.css("input[type=file]")),
        fileToUpload = "../test_image/download.jpeg",
        absolutePath = path.resolve(__dirname, fileToUpload);
      
        uploadInput.sendKeys(absolutePath);



    });
});