describe('Protractor Typescript Demo', function () {

    it('Excel File Operations', function () {


screenShotUtils.takeScreenshot().then(function(base64string){
    //logic to save the image to file.

    screenShotUtils.takeScreenshot({
        saveTo: "fullpageScreenshot.png"
     })
});
    });
});