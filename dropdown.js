describe('Protractor Typescript Demo', function() {
	browser.ignoreSynchronization = true; // for non-angular websites
	it('Excel File Operations', function() {
		// set implicit time to 30 seconds
		browser.manage().timeouts().implicitlyWait(30000);

		browser.get("https://chercher.tech/practice/dropdowns")

		// find click the dropdown
		element(by.tagName("select#animals")).click();
		// add sleep to give a time for te options to reveal
		browser.sleep(1000)
		// click the option which has value='Yahoo'
        element(by.css("#animals [value='babycat']")).click();
        
        browser.sleep(10000)
	});
});
