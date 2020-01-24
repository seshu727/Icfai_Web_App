var PageObject = require('./PageObject.js');

describe('angularjs homepage', function () {
    var page;

    beforeEach(function () {
        page = new PageObject();
        browser.get('https://www.angularjs.org');
    });

    it('should fail as greeting text is different', function () {
        page.yourNameInputField.sendKeys('Julie');
        expect(page.greetingText.getText()).toEqual('Hello Julie hello!');
    });

    it('should greet the named user', function () {
        page.yourNameInputField.sendKeys('Julie');
        expect(page.greetingText.getText()).toEqual('Hello Julie!');
    });

    it('should contain log and pretty stack trace', function () {
        browser.executeScript("console.warn('This is some kind of warning!');");
        browser.executeScript("console.info('This is some kind of information!');");
        browser.executeScript("console.error('This is some kind of warning!');");

        browser.executeScript("arguments[0].addEventListener('click', function() { return throw new TypeError('type error'); })", page.addButton);
        page.addButton.click();

        page.yourNameInputField.sendKeys('Julie');
        expect(page.greetingText.getText()).toEqual('Hello Julie hello!');
    });

    describe('todo list', function () {

        it('should list todos', function () {
            expect(page.todoList.count()).toEqual(2);
        });

        it('should display first todo with proper text', function () {
            expect(page.todoList.get(1).getText()).toEqual('build an AngularJS app');
        });

        it('should fail because we check for wrong text for demonstration', function () {
            expect(page.todoList.get(1).getText()).toEqual('Does not match');
        });

        it('should add a todo', function () {
            page.addTodo.sendKeys('write a protractor test');
            page.addButton.click();
            expect(page.todoList.count()).toEqual(3);
            expect(page.todoList.get(2).getText()).toEqual('write a protractor test');
        });

        xit('should be displayed as pending test case', function () {
            expect(page.todoList.get(1).getText()).toEqual('build an AngularJS app');
        });
    });

    xdescribe('pending describe', function () {

        it('pending test case 1', function () {
        });

        it('pending test case 2', function () {
        });

    });

    describe('nested deeply spec level 1', function () {
        it('level 1 it nr1', function () {

        });
        it('level 1 it nr2', function () {

        });
        describe('nested deeply spec level 2', function () {
            it('level 2 it nr 1', function () {

            });
            it('level 2 it nr 2', function () {

            });
            it('level 2 it nr 3', function () {

            });
            it('level 2 it nr 4', function () {

            });
            describe('nested deeply spec level 3', function () {
                it('level 3 it nr 1', function () {

                });
                it('level 3 it nr2', function () {

                });
                describe('nested deeply spec level 4', function () {
                    it('level 4 it nr 1', function () {
                        browser.executeScript("console.warn('Warn nexted deepply spec level4 test!');");
                    });
                    it('level 4 it nr 2', function () {

                    });
                });
            });
        });
    });
});

describe('second top level', function () {
    var page;

    beforeEach(function () {
        page = new PageObject();
        browser.waitForAngularEnabled(false);
        browser.get('https://www.w3.org/History.html');
    });

    it('direct level 2 it', function () {

    });

    describe('nested deeply spec level 1', function () {
        it('level 1 it nr1', function () {

        });
        it('level 1 it nr2', function () {

        });
        describe('nested deeply spec level 2', function () {
            it('level 2 it nr 1', function () {

            });
            it('level 2 it nr 2', function () {

            });
            describe('nested deeply spec level 3', function () {
                it('level 3 it nr 1', function () {

                });
                it('level 3 it nr2', function () {

                });
                describe('nested deeply spec level 4', function () {
                    it('level 4 it nr 1', function () {

                    });
                    it('level 4 it nr 2', function () {

                    });
                    it('level 4 it nr 3', function () {

                    });
                    it('level 4 it nr 4', function () {

                    });
                    it('level 4 it nr 5', function () {

                    });
                    it('level 4 it nr 6', function () {

                    });
                    it('level 4 it nr 7', function () {

                    });
                    it('level 4 it nr 8', function () {

                    });
                    it('level 4 it nr 9', function () {

                    });
                    it('level 4 it nr 10', function () {

                    });
                    it('level 4 it nr 11', function () {

                    });
                    it('level 4 it nr 12', function () {

                    });
                    it('level 4 it nr 13', function () {

                    });
                    it('level 4 it nr 14', function () {

                    });
                    it('level 4 it nr 15', function () {

                    });
                    it('level 4 it nr 16', function () {

                    });
                    it('level 4 it nr 17', function () {

                    });
                    it('level 4 it nr 18', function () {

                    });
                    it('level 4 it nr 19', function () {

                    });
                    it('level 4 it nr 20', function () {

                    });
                    it('level 4 it nr 21', function () {

                    });
                    it('level 4 it nr 22', function () {

                    });
                    it('level 4 it nr 23', function () {

                    });
                    it('level 4 it nr 24', function () {

                    });
                    it('level 4 it nr 25', function () {

                    });
                    it('level 4 it nr 26', function () {

                    });
                    it('level 4 it nr 27', function () {

                    });
                    it('level 4 it nr 28', function () {

                    });
                    it('level 4 it nr 29', function () {

                    });
                    it('level 4 it nr 30', function () {

                    });
                    it('level 4 it nr 31', function () {

                    });
                    it('level 4 it nr 32', function () {

                    });
                    it('level 4 it nr 33', function () {

                    });
                    it('level 4 it nr 34', function () {

                    });
                    it('level 4 it nr 35', function () {

                    });
                    it('level 4 it nr 36', function () {

                    });
                    it('level 4 it nr 37', function () {

                    });
                    it('level 4 it nr 38', function () {

                    });
                    it('level 4 it nr 39', function () {

                    });
                    it('level 4 it nr 40', function () {

                    });
                });
            });
        });
    });
});