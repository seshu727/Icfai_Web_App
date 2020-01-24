var ic = require('./Homepage.js');
describe('admin login functionality', function () {

    var Homepage1 = new ic();
    it('admin login', function () {

        Homepage1.wait();
        Homepage1.get();
        Homepage1.getMax();
        Homepage1.loginpage();
        Homepage1.loaction1();
        Homepage1.batch();
        Homepage1.batchsubject();
        Homepage1.subjectChapter();
        Homepage1.facultycreation();
        Homepage1.Facultyupdation();

    });

});