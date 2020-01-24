describe('Protractor Typescript Demo', function () {

    it('Excel File Operations', function () {

        var Excel = require('exceljs');
        var wb = new Excel.Workbook()
        // read xlsx file type
     wb.xlsx.readFile("./Inputdata.xlsx").then(function () {
            //sheet object
        let sheet = wb.getWorksheet('Sheet2');
            //row objct

           let rowObject = sheet.rowCount

            console.log('no of rows :' + rowObject);

            let rowvalue = sheet.getRow(2).getCell(1).toString()

            //  console.log('no of rows :' + rowvalue);
            let rowvalue1 = sheet.getRow(2).getCell(2).toString()

            // console.log('no of rows :' + rowvalue1);

            let colcount = sheet.columnCount
            console.log(" cols count  " + colcount);


            for (i = 0; i < rowObject; i++) {

                //let data = sheet.getRow(i).getCell(1).toString();
                // let data1 = sheet.getRow(i).getCell(2).toString();
                //  console.log(data + "   " + data1);
                // console.log(+data1 + "  ");
                for (j = 0; j < colcount; j++) { 
                    let data2 = sheet.getRow(i).getCell(j).toString();
                    console.log(" " + data2 + "  ");

            // sheet.getRow(1).getCell(4).value = "first time wring to excel sheet"
                }
            }
           
            //to convert number to string we use tostring()
            

            //  sheet.getRow(4).getCell(4).value = 50;
            //wb.xlsx.writeFile('./test1.xlsx');
            //console.log(sheet.getRow(4).getCell(4).value);


            //let title = "tester";

            // sheet.getRow(4).getCell(4).value = 50;
            // wb.xlsx.writeFile('./test.xlsx');
            //console.log(sheet.getRow(4).getCell(4).value);
        });
    });
});
