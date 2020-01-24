var HtmlReporter = require('protractor-beautiful-reporter');

exports.config = {
//framework: 'jasmine',
  seleniumAddress: 'http://localhost:4444/wd/hub',
  specs: [
    // 'dropdown1.js'
    // 'datafromexcel.js'
    //' writingdata.js'
    //'readingdatafromrows.js'
    //'screenshot.js'
    //'failedcases.js'
   // 'reports.js'
   //'uploadfile.js'
  // 'datepicker.js'
  //'test1.js',
  //'test2.js'
  'datafromexcel.js'
  ],
  jasmineNodeOpts: {
    defaultTimeoutInterval: 2500000
    },
  onPrepare: function() {
    // Add a screenshot reporter and store screenshots to `/tmp/screenshots`:
    jasmine.getEnv().addReporter(new HtmlReporter({
    baseDirectory: 'tmp/screenshots',
     docTitle: 'my reporter' // Title of report
    }).getJasmine2Reporter()); 
    }
  
  };
