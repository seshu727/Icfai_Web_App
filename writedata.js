describe('Protractor Typescript Demo', function () {

    browser.ignoreSynchronization = true; // for non-angular websites
    it('Excel File Operations', function () {
        // set implicit time to 30 seconds
        //browser.manage().timeouts().implicitlyWait(30000);
        var Excel = require('exceljs');
        var wb = new Excel.Workbook();
        // create object for workbook
        //var wb = new Workbook();
        // read xlsx file type
        wb.csv.readFile('./Test.csv').then(function () {
            //sheet object
            let sheet = wb.getWorksheet("Sheet1");
            // write to excel sheet
            sheet.getRow(1).getCell(1).value = "first time wring to excel sheet"
            wb.xlsx.writeFile("./Test.xlsx").then(function () {

                console.log("  " + sheet.getRow(3).getCell(2).value);
            })

        });
    });
});
