describe('Protractor Typescript Demo', function () {

    it('Excel File Operations', function () {

var excel = require("exceljs");
var workbook1 = new excel.Workbook();
//workbook1.creator = 'Me';
///workbook1.lastModifiedBy = 'Me';
//workbook1.created = new Date();
//workbook1.modified = new Date();
var sheet1 = workbook1.addWorksheet('SeshuMaster');
var sheet2 = workbook1.addWorksheet('ICFAI');
var sheet3 = workbook1.addWorksheet('Faculty');
var reColumns=[
    {header:'ScenarioID',key:'stcol '},
    {header:'TestcaseID',key:'ndcol'},
    {header:'Expected result',key:'rdcol'},
    {header:'Actual result',key:'rthcol'},
    {header:'status',key:'thcol'}
    
];
sheet1.columns = reColumns;
sheet1.addRows([{ stcol: "TS_IC_1", ndcol: "TC_IC_001", rdcol: "index page showing", rthcol: " login page showing" ,  thcol: " failed"}]) 
sheet2.columns =reColumns;
workbook1.xlsx.writeFile("./test10.xlsx").then(function() {
    console.log("check the sheet");
});
    });
});