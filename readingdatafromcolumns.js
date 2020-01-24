describe('Protractor Typescript Demo', function () {

    it('Excel File Operations', function () {

var excel = require("exceljs");
var workbook1 = new excel.Workbook();
//workbook1.creator = 'Me';
///workbook1.lastModifiedBy = 'Me';
//workbook1.created = new Date();
//workbook1.modified = new Date();
var sheet1 = workbook1.addWorksheet('SeshuMaster');
var reColumns=[
    {header:'username',key:'1stcol '},
    {header:'password',key:'2ndcol'},
    {header:'status',key:'3rdcol'}
];
sheet1.columns = reColumns;
workbook1.xlsx.writeFile("./test10.xlsx").then(function() {
    console.log("xlsx file is written.");
});
    });
});