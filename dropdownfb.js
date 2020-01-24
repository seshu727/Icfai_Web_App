describe('Protractor Typescript Demo', function () {

    it('Excel File Operations', function () {
        browser.waitForAngularEnabled(false);

        browser.get('http://facebook.com')
        browser.manage().window().maximize();
        import {browser, by, ElementFinder } from "protractor";
        export class Select {
            // dropdown
            dropdown;
            //constructor  accepts dropdown as element
            constructor(dropdownElement) {
                // assign block variable to the global variable
               this.dropdown = dropdownElement;
               // click the dropdown
               dropdownElement.click()
               browser.sleep(1000)
            }
            selectByIndex(index){
                index = index + 1;
                console.log("Selecting element based index : "+index)
                // select the option
                this.dropdown.element(by.css("option:nth-child("+index+")")).click()
            }
         }
        
    });
});
