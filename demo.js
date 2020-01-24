describe('Demo', function () {

    browser.ignoreSynchronization = true; // for non-angular websites

    it('TextField Test', function () {

        browser.ignoreSynchronization = true;

        browser.get("http://v3demo.zeroco.de/#/zcbase")

        //username
        element(by.id('appUserName')).sendKeys('admin')
        browser.sleep(1000)

        //password
        element(by.id('appPassword')).sendKeys('The@1234')
        browser.sleep(1000)


        //clicking login button
        element(by.id("loginBtn")).click();
        browser.sleep(2000)

        element(by.xpath("//strong[text()='Threshold Demo']")).click()
        browser.sleep(2000)

    })
        it('Automation', function () {

            var Excel = require('exceljs');
            var wb = new Excel.Workbook();

            wb.xlsx.readFile("./Inputdata.xlsx").then(function () {

                var sh = wb.getWorksheet("Sheet1");

                let totalRowsIncludingEmptyRows = sh.rowCount

                console.log("total nuumber of rows : " + totalRowsIncludingEmptyRows)

                let colcount = sheet.columnCount
                console.log(" cols count  " + colcount);

                // loop till end of row

                for (let i = 1; i <= totalRowsIncludingEmptyRows; i++) {

                 

                    let inputs =sh.totalRowsIncludingEmptyRows.                   
                    console.log(' ' + inputs)

                    element(by.id('name')).sendKeys(inputs)
                    browser.sleep(2000)

                    browser.refresh()
                    browser.sleep(1000)



                }

            })
        })
    
})