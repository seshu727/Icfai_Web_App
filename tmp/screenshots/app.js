var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };


    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };

    var results = [
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "1d06f37dbb87a82afb265a91b3720192",
        "instanceId": 11840,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:365:31)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076505843,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076505950,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076505950,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076522240,
                "type": ""
            }
        ],
        "screenShotFile": "00df003e-0000-00bb-0052-00a300c1000f.png",
        "timestamp": 1570076497634,
        "duration": 34902
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "eb0994a72af48e6f831052fc3319ff1f",
        "instanceId": 12072,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:365:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076694825,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076694826,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076695038,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076714144,
                "type": ""
            }
        ],
        "screenShotFile": "00a40051-008f-003c-0075-00560057001f.png",
        "timestamp": 1570076688261,
        "duration": 26460
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "1a97a5bf8f0ff31daef5e9628aef17b3",
        "instanceId": 2512,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[contains(text(),'Marketing')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[contains(text(),'Marketing')])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:373:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076762177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076762178,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076762531,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076781933,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076812883,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076813713,
                "type": ""
            }
        ],
        "screenShotFile": "00ed0090-000a-00ea-00fd-00be004200c7.png",
        "timestamp": 1570076756378,
        "duration": 77637
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "4a01714302f1b0d5e8bc9cdf0b01e88f",
        "instanceId": 1040,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[contains(text(),'Marketing')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[contains(text(),'Marketing')])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:370:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076920348,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076920348,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076920348,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076932339,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570076953646,
                "type": ""
            }
        ],
        "screenShotFile": "00220069-00f5-00d0-0051-0042000b0018.png",
        "timestamp": 1570076899331,
        "duration": 74850
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "29ea2403c49b16bc1279a3995f13e9b3",
        "instanceId": 1920,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[contains(text(),'Marketing')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[contains(text(),'Marketing')])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:370:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077013104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077013104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077013287,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077036335,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077057796,
                "type": ""
            }
        ],
        "screenShotFile": "000f001c-00c7-00d1-0096-007d003600cf.png",
        "timestamp": 1570077005125,
        "duration": 73291
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "c67c44a3a500e727e7c953ddb27c474c",
        "instanceId": 1292,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/table[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:383:27)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077166799,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077166799,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077166940,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077184788,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077205935,
                "type": ""
            }
        ],
        "screenShotFile": "00100018-00ce-00f8-0098-00e700be00a6.png",
        "timestamp": 1570077162154,
        "duration": 105954
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "8c36f0b381a6990eff4c03be61ce7de1",
        "instanceId": 9084,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //a[@class=\"icon-edit p-1 ng-star-inserted\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //a[@class=\"icon-edit p-1 ng-star-inserted\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077321712,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077321725,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077321739,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077341590,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077362522,
                "type": ""
            }
        ],
        "screenShotFile": "00b20010-0091-0095-000f-00cf000c0094.png",
        "timestamp": 1570077316107,
        "duration": 128910
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "3f0a72a3e0b2a4baefaf71b0084f8a5f",
        "instanceId": 8968,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //a[@class=\"icon-edit p-1 ng-star-inserted\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //a[@class=\"icon-edit p-1 ng-star-inserted\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077526891,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077526891,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077527076,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077543510,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077574986,
                "type": ""
            }
        ],
        "screenShotFile": "00750008-00d4-0008-0038-00f7003500fb.png",
        "timestamp": 1570077519801,
        "duration": 127334
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "befc5687db866bc9933f94d675de5e28",
        "instanceId": 6376,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //a[@class=\"icon-edit p-1 ng-star-inserted\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //a[@class=\"icon-edit p-1 ng-star-inserted\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077708780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077708780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077708780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077719803,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077741516,
                "type": ""
            }
        ],
        "screenShotFile": "00f7008e-0011-0025-0026-005100ac0094.png",
        "timestamp": 1570077698173,
        "duration": 135913
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "a27982030794f20e34aded0f9d965aed",
        "instanceId": 6312,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <div class=\"ui-dropdown-trigger ui-state-default ui-corner-right\">...</div> is not clickable at point (1315, 238). Other element would receive the click: <div class=\"loader ng-star-inserted\" style=\"color:red\">...</div>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <div class=\"ui-dropdown-trigger ui-state-default ui-corner-right\">...</div> is not clickable at point (1315, 238). Other element would receive the click: <div class=\"loader ng-star-inserted\" style=\"color:red\">...</div>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:368:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077957980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077957980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077957980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077971275,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570077992708,
                "type": ""
            }
        ],
        "screenShotFile": "003400f1-0094-002e-002a-0033004b001d.png",
        "timestamp": 1570077944618,
        "duration": 48074
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "1c9499bfa3a8f3886824ebd2f2d5a1ab",
        "instanceId": 1572,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: script timeout: result was not received in 11 seconds\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "ScriptTimeoutError: script timeout: result was not received in 11 seconds\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"appUserName\"])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.loginpage (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:97:19)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:10:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570083202770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570083202770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570083203014,
                "type": ""
            }
        ],
        "screenShotFile": "00270016-00ca-00e7-0036-00a800ee00b7.png",
        "timestamp": 1570083172397,
        "duration": 47765
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "e1e1b00cedfcd13c4c6d717bf228994f",
        "instanceId": 1160,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570085709768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570085709768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570085709768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570085726709,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570085747854,
                "type": ""
            }
        ],
        "screenShotFile": "00610084-00c7-00ae-0036-0096002b006a.png",
        "timestamp": 1570085703954,
        "duration": 136671
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "bbd1bf812e50ca7860b0faa27d9b7cc2",
        "instanceId": 808,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086159487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086159487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086159597,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086175934,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086179261,
                "type": ""
            }
        ],
        "screenShotFile": "00260074-003e-005a-0012-00a50028005a.png",
        "timestamp": 1570086154124,
        "duration": 45485
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "ed2f9842fe61f185c77bdb75d6c93580",
        "instanceId": 12252,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086224598,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086224598,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086224763,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086241080,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086244201,
                "type": ""
            }
        ],
        "screenShotFile": "003b00ae-00d6-00ec-0015-009100cc0091.png",
        "timestamp": 1570086218173,
        "duration": 46474
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "565038d3f652fcd5a603e5ad952fa206",
        "instanceId": 7768,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <div class=\"ui-dropdown-trigger ui-state-default ui-corner-right\">...</div> is not clickable at point (1315, 238). Other element would receive the click: <div class=\"loader ng-star-inserted\" style=\"color:red\">...</div>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <div class=\"ui-dropdown-trigger ui-state-default ui-corner-right\">...</div> is not clickable at point (1315, 238). Other element would receive the click: <div class=\"loader ng-star-inserted\" style=\"color:red\">...</div>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:368:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086301139,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086301139,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086301139,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086317170,
                "type": ""
            }
        ],
        "screenShotFile": "0063008e-0039-0021-008a-00b9006700fa.png",
        "timestamp": 1570086295631,
        "duration": 24858
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "1f4d2321b501bbdf76eaf0d27e4cd546",
        "instanceId": 5716,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086338666,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086338666,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086338851,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086354885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086357890,
                "type": ""
            }
        ],
        "screenShotFile": "00430081-00ac-00b6-007e-00e2008e000d.png",
        "timestamp": 1570086334505,
        "duration": 51770
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "abc6d393bcff95f900b418760e565b8f",
        "instanceId": 3444,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:389:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086427602,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086427602,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086427770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086444033,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086447017,
                "type": ""
            }
        ],
        "screenShotFile": "000a00d2-00ac-0053-0099-0068009f00a2.png",
        "timestamp": 1570086423056,
        "duration": 52497
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "24fece4335e989e4cf4bc99196d086dd",
        "instanceId": 10172,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:393:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086647137,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086647143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086647144,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086663460,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570086666672,
                "type": ""
            }
        ],
        "screenShotFile": "002a00e0-0016-007b-006c-002d006a007c.png",
        "timestamp": 1570086642230,
        "duration": 73185
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "704ca42eb0e1c212f4b6b3daeb60073e",
        "instanceId": 7940,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span class=\"ng-tns-c11-13 ng-star-inserted\">...</span> is not clickable at point (1051, 321). Other element would receive the click: <span class=\"ng-tns-c11-13 ng-star-inserted\">...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span class=\"ng-tns-c11-13 ng-star-inserted\">...</span> is not clickable at point (1051, 321). Other element would receive the click: <span class=\"ng-tns-c11-13 ng-star-inserted\">...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:393:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570092743689,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570092743689,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570092743836,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570092760605,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570092763713,
                "type": ""
            }
        ],
        "screenShotFile": "007e0063-003c-0025-0074-00a6000c00c5.png",
        "timestamp": 1570092736604,
        "duration": 99881
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "defa3649f3602570a8b035db823ad2bf",
        "instanceId": 13336,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:393:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093672099,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093672099,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093672099,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093689035,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093691934,
                "type": ""
            }
        ],
        "screenShotFile": "00a0005e-00db-0026-000c-009b002f0099.png",
        "timestamp": 1570093665312,
        "duration": 75403
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "ccc541db5b5e23376bf281607ec15c5b",
        "instanceId": 12420,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:394:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093902521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093902521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093902674,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093919544,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570093922700,
                "type": ""
            }
        ],
        "screenShotFile": "00bb00c6-0077-0006-008c-00e600bf002a.png",
        "timestamp": 1570093896017,
        "duration": 75364
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "389c27745566d5c5a04c394d4816be49",
        "instanceId": 13900,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:394:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094005920,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094005920,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094006059,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094023394,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094026424,
                "type": ""
            }
        ],
        "screenShotFile": "00b100cb-001e-0046-001e-001500c60072.png",
        "timestamp": 1570094000991,
        "duration": 84215
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "94c9084a99786eabcc7034231aef1ebf",
        "instanceId": 5096,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:394:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094124960,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094124960,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094124961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094141643,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094144666,
                "type": ""
            }
        ],
        "screenShotFile": "00330099-009e-00d6-0058-00190020005d.png",
        "timestamp": 1570094120241,
        "duration": 83397
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "e318809aad152449ea2b7f389ff0cb72",
        "instanceId": 12960,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:394:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094250693,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094250694,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094250798,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094267165,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094270181,
                "type": ""
            }
        ],
        "screenShotFile": "0041002b-00e7-0079-0054-00d3004d000d.png",
        "timestamp": 1570094243212,
        "duration": 85732
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "d6401f37de1358a29bdd54e40f4f45b5",
        "instanceId": 2292,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094396375,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094396376,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094396378,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094412697,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094415724,
                "type": ""
            }
        ],
        "screenShotFile": "00f4002d-0099-0092-0059-007c00140075.png",
        "timestamp": 1570094391360,
        "duration": 87817
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "3ce7958c6202b199d63ae5add11d0211",
        "instanceId": 13160,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: Angular could not be found on the page http://v3icfai.zeroco.de/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page http://v3icfai.zeroco.de/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at executeAsyncScript_.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:720:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://v3icfai.zeroco.de/ - Access to XMLHttpRequest at 'http://v3svc.zeroco.de/zc-v3-user-svc/2.0/v3icfai/zc-setting' from origin 'http://v3icfai.zeroco.de' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1570094678846,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://v3icfai.zeroco.de/main.42794e68e8c3b83870e5.js 0:33835 \"Backend returned status code: \" 0",
                "timestamp": 1570094678847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://v3icfai.zeroco.de/main.42794e68e8c3b83870e5.js 0:33892 \"Response body:\" \"Http failure response for (unknown url): 0 Unknown Error\"",
                "timestamp": 1570094678847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://v3icfai.zeroco.de/main.42794e68e8c3b83870e5.js 0:1564615 e",
                "timestamp": 1570094678847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://v3svc.zeroco.de/zc-v3-user-svc/2.0/v3icfai/zc-setting - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1570094678847,
                "type": ""
            }
        ],
        "screenShotFile": "002d00bf-0004-0064-00f7-003f0002009b.png",
        "timestamp": 1570094674292,
        "duration": 14669
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "aa95c1d23192303eaa75af9563c95da3",
        "instanceId": 856,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batch (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:224:22)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:12:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094720517,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094720517,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094720664,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094737065,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094748110,
                "type": ""
            }
        ],
        "screenShotFile": "005500b1-008f-00d6-009e-007700140074.png",
        "timestamp": 1570094715909,
        "duration": 44485
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "f053dd979579f6a7bb489676514f0aea",
        "instanceId": 13596,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batch (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:224:22)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:12:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094829948,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094829948,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094830096,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094846365,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094857383,
                "type": ""
            }
        ],
        "screenShotFile": "009a00f8-000a-00dc-00a8-006000590024.png",
        "timestamp": 1570094824430,
        "duration": 45193
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "70a81f9e374264847c14729c30c14799",
        "instanceId": 5940,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batch (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:225:22)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:12:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094929482,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094929545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094929796,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094947568,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094958636,
                "type": ""
            }
        ],
        "screenShotFile": "00ad006f-00b1-00bf-0020-0045003d003e.png",
        "timestamp": 1570094924841,
        "duration": 45882
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "f7308b955090ddc520844fda2deb3d75",
        "instanceId": 1200,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/zc-com-render[1]/div[1]/zc-menu[1]/ul[1]/li[2]/ul[1]/li[6]/a[1]/span[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:366:31)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094996767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094996768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570094996872,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095013167,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095024129,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095036732,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095101454,
                "type": ""
            }
        ],
        "screenShotFile": "008c0014-00e5-0030-0060-006f001900b8.png",
        "timestamp": 1570094992171,
        "duration": 176454
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "967693fb96f47ac3ac316c5fae863764",
        "instanceId": 9648,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/zc-com-render[1]/div[1]/zc-menu[1]/ul[1]/li[2]/ul[1]/li[6]/a[1]/span[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:366:31)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095232111,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095232111,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095232293,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095248671,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095259767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095272062,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095336875,
                "type": ""
            }
        ],
        "screenShotFile": "0081002d-002a-00b6-001c-00d9007600ec.png",
        "timestamp": 1570095227592,
        "duration": 176243
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "17b57cde9aacb2c65b8db3a2b7954d9e",
        "instanceId": 12936,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095676489,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095676489,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095676663,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095694586,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095715296,
                "type": ""
            }
        ],
        "timestamp": 1570095672168,
        "duration": 124413
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "343a3f451750b79867cedb6c44ad2f55",
        "instanceId": 7788,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095822931,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095822931,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095823080,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095839543,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570095860220,
                "type": ""
            }
        ],
        "timestamp": 1570095818880,
        "duration": 122697
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "454edfbc2997dc678a7b050e93e5eb18",
        "instanceId": 12220,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096095111,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096095114,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096095115,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096115796,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096136480,
                "type": ""
            }
        ],
        "timestamp": 1570096090687,
        "duration": 128883
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "a1eeb7153e2975b39fcaa20cdcf31ddb",
        "instanceId": 13316,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:363:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096412821,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096412821,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096413068,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096429409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096450094,
                "type": ""
            }
        ],
        "screenShotFile": "00e6001e-0016-002e-00a6-004600480077.png",
        "timestamp": 1570096408708,
        "duration": 132744
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "4667f019e453795f11a10839ebdbe431",
        "instanceId": 13624,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:363:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096584875,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096584875,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096585066,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096601798,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096622460,
                "type": ""
            }
        ],
        "screenShotFile": "001100af-00ad-0050-00ba-001d0010004f.png",
        "timestamp": 1570096577937,
        "duration": 135895
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "490d97867427ca2c23e6b870d8070ad6",
        "instanceId": 12980,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:363:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096808644,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096808644,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096808870,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096825133,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096845806,
                "type": ""
            }
        ],
        "screenShotFile": "000e00aa-009c-00c3-0025-004600fd003b.png",
        "timestamp": 1570096803871,
        "duration": 133352
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "f567c792d25eba43542f645a81a5a6e8",
        "instanceId": 6604,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:364:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096996412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096996516,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570096996517,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097012925,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097033520,
                "type": ""
            }
        ],
        "screenShotFile": "00d6008a-006c-0056-00de-000d00400068.png",
        "timestamp": 1570096991622,
        "duration": 152281
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "1436c7cc3037c41934164aecf3e4547e",
        "instanceId": 5592,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097283508,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097283509,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097283712,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097299849,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097320543,
                "type": ""
            }
        ],
        "timestamp": 1570097278220,
        "duration": 153534
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "5326fa175ce31466da52473b8b2c451d",
        "instanceId": 12880,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/zc-com-render[1]/div[1]/zc-menu[1]/ul[1]/li[2]/ul[1]/li[6]/a[1]/span[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:374:31)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097575216,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097575216,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097575216,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097586539,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097597534,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097610241,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097675068,
                "type": ""
            }
        ],
        "screenShotFile": "007e006d-0096-00dd-0047-00e6001b0029.png",
        "timestamp": 1570097563911,
        "duration": 223258
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "6635932a413fb97e5fb9381c2719dc5b",
        "instanceId": 7844,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:377:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097881067,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097881067,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097881231,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097898359,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097909323,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097921566,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570097986515,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098099323,
                "type": ""
            }
        ],
        "screenShotFile": "00de00d6-0037-00ce-00d7-00fe00970091.png",
        "timestamp": 1570097876176,
        "duration": 234485
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "d0f9f97c7dc9a04a7942efea6170d193",
        "instanceId": 8468,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:364:22)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098332263,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098332264,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098332418,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098348804,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098359858,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098372115,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098436947,
                "type": ""
            }
        ],
        "screenShotFile": "00fb00e0-007f-004d-0047-00ba00c50019.png",
        "timestamp": 1570098327303,
        "duration": 219898
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "ca81a0e877de928cf44c33abcc8bf414",
        "instanceId": 14024,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[2])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:364:22)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098937783,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098937783,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098937961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098954606,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098965574,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570098977784,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099042639,
                "type": ""
            }
        ],
        "screenShotFile": "00dd0015-00da-001a-0074-00ae00640040.png",
        "timestamp": 1570098932126,
        "duration": 220775
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "3d4273ed9a3685025a9d2156b7826b1c",
        "instanceId": 14232,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:378:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099541960,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099541960,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099542131,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099558584,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099569653,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099586451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099650466,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099731896,
                "type": ""
            }
        ],
        "screenShotFile": "00be0001-003a-0068-00bb-00d4006d0027.png",
        "timestamp": 1570099537579,
        "duration": 205608
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "5e36bc21cb192e7655182b8ed3c5009a",
        "instanceId": 13012,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: chrome not reachable\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: chrome not reachable\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/p-paginator[1]/div[1]/div[1]/a[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batch (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:256:20)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:12:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099922179,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099922179,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099922198,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099939827,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099951099,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570099967036,
                "type": ""
            }
        ],
        "timestamp": 1570099917046,
        "duration": 68178
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "4a4871628a685621a10e659c059b6a07",
        "instanceId": 7392,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:383:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100032766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100032766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100032936,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100051126,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100062212,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100078184,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100143120,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100224787,
                "type": ""
            }
        ],
        "screenShotFile": "00550073-0058-0016-0093-00d700ed0026.png",
        "timestamp": 1570100027342,
        "duration": 208880
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "7e70fe1563905f42bb747c44d8daf90b",
        "instanceId": 10372,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: clickonsubject1 is not defined"
        ],
        "trace": [
            "ReferenceError: clickonsubject1 is not defined\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:407:9)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a20076-00bf-0014-00e4-008200020018.png",
        "timestamp": 1570100456015,
        "duration": 1241
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "772b8df37267fe7d2cdd7143cb0c92c2",
        "instanceId": 4976,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.Facultyupdation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:167:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:16:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100534607,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100534608,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100534789,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100551228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100562480,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100672049,
                "type": ""
            }
        ],
        "screenShotFile": "00090004-0077-00fb-00a8-003c00420081.png",
        "timestamp": 1570100529700,
        "duration": 247882
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "a6c6fea6c49d28f841252ddf02956eb7",
        "instanceId": 13456,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.facultycreation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:119:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:15:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100839580,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100839632,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100839738,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100856043,
                "type": ""
            }
        ],
        "screenShotFile": "007400e7-00de-006a-0007-009a0078000a.png",
        "timestamp": 1570100834919,
        "duration": 31447
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "0e8a520c8900c4b5e9994e3cf9f78d26",
        "instanceId": 4960,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.facultycreation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:119:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:15:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100906703,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100906703,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100906849,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100923296,
                "type": ""
            }
        ],
        "screenShotFile": "0059008b-005b-0078-0034-00fc000300d2.png",
        "timestamp": 1570100901178,
        "duration": 32441
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "d1782b9dc44edfedc9ff96f9a7148791",
        "instanceId": 6500,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.Facultyupdation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:167:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:16:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100974474,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100974474,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100974603,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570100993428,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101014105,
                "type": ""
            }
        ],
        "screenShotFile": "00a800fd-005b-006d-0003-006a007300ff.png",
        "timestamp": 1570100968649,
        "duration": 150881
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "1b22bec6d832c9d8d5292bccc2699848",
        "instanceId": 13068,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.Facultyupdation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:168:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:16:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101391427,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101391427,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101391609,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101407565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101428181,
                "type": ""
            }
        ],
        "screenShotFile": "00e80053-004b-0093-006b-0052004300a5.png",
        "timestamp": 1570101379941,
        "duration": 158735
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "885119fd5099557121d8af6043484ac7",
        "instanceId": 14252,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <a _ngcontent-c27=\"\" class=\"icon-edit p-1 ng-star-inserted\" title=\"Edit\"></a> is not clickable at point (1223, 425). Other element would receive the click: <ngb-modal-window role=\"dialog\" tabindex=\"-1\" class=\"modal fade show d-block zc-field-table-modal\" aria-modal=\"true\">...</ngb-modal-window>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <a _ngcontent-c27=\"\" class=\"icon-edit p-1 ng-star-inserted\" title=\"Edit\"></a> is not clickable at point (1223, 425). Other element would receive the click: <ngb-modal-window role=\"dialog\" tabindex=\"-1\" class=\"modal fade show d-block zc-field-table-modal\" aria-modal=\"true\">...</ngb-modal-window>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.102', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.Facultyupdation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:179:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:16:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101635090,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101635090,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101635274,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101651604,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101672263,
                "type": ""
            }
        ],
        "screenShotFile": "00060042-0076-0001-006e-006e00d900d2.png",
        "timestamp": 1570101630469,
        "duration": 144142
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "702b47d1d005bedcb0b05e42ab1302cd",
        "instanceId": 7220,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[@class=\"ui-dropdown-trigger ui-state-default ui-corner-right\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[@class=\"ui-dropdown-trigger ui-state-default ui-corner-right\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.facultycreation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:126:23)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:15:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101885577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101885578,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101885578,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101901886,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570101922573,
                "type": ""
            }
        ],
        "screenShotFile": "00cf0069-0041-00ef-0008-008300f10091.png",
        "timestamp": 1570101880770,
        "duration": 53306
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "e8eadd3eb60fa24da4cb4a23f5e1daeb",
        "instanceId": 7692,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[@class=\"card card-active ng-star-inserted\"]//i[@class=\"ui-clickable icon-edit-book-1 ng-star-inserted\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[@class=\"card card-active ng-star-inserted\"]//i[@class=\"ui-clickable icon-edit-book-1 ng-star-inserted\"])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.Facultyupdation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:162:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:16:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570102969097,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570102969097,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570102969245,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570102985649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570103006260,
                "type": ""
            }
        ],
        "screenShotFile": "00950061-001e-0076-00ce-00ce00d6008b.png",
        "timestamp": 1570102964242,
        "duration": 147762
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "a5c141fd267badfa2ac32b60fc618a06",
        "instanceId": 9520,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //html[1]/body[1]/div[4]/div[2]/ul[1]/p-multiselectitem[2]/li[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //html[1]/body[1]/div[4]/div[2]/ul[1]/p-multiselectitem[2]/li[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.Facultyupdation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:178:27)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:16:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105003303,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105003412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105003412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105019846,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105040587,
                "type": ""
            }
        ],
        "screenShotFile": "00b700ab-0036-00fd-0068-00610053000a.png",
        "timestamp": 1570104997326,
        "duration": 186978
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "0cdd3a50edde46ee30743be05a6a95ea",
        "instanceId": 12852,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //html[1]/body[1]/div[4]/div[2]/ul[1]/p-multiselectitem[2]/li[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //html[1]/body[1]/div[4]/div[2]/ul[1]/p-multiselectitem[2]/li[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.Facultyupdation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:178:27)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:16:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105231024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105231024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105231215,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105247676,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570105268265,
                "type": ""
            }
        ],
        "screenShotFile": "00620054-00c9-00b4-00f7-009900930097.png",
        "timestamp": 1570105225060,
        "duration": 186026
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "bdeb0f3a2c524949f3513a8937f56fe5",
        "instanceId": 14720,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.137.1', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.137.1', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:377:31)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570166109254,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570166109254,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570166109254,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570166130665,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570166141876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570166159715,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570166225740,
                "type": ""
            }
        ],
        "screenShotFile": "00710087-000f-0055-00f9-000f00160056.png",
        "timestamp": 1570166101891,
        "duration": 214608
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "877d29459ec3cc5b16ef692c6e81e845",
        "instanceId": 1780,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/table[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:324:27)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570788327341,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570788327341,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570788327341,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570788344732,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570788356579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570788373937,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570788438832,
                "type": ""
            }
        ],
        "screenShotFile": "00b900e6-0008-00e8-00df-000500fe00d8.png",
        "timestamp": 1570788309620,
        "duration": 146502
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "78f19540514e56efae2b7c6707e74ce1",
        "instanceId": 4044,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/table[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:324:27)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570798197603,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570798197603,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570798197741,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570798214223,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570798225766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570798241888,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1570798307028,
                "type": ""
            }
        ],
        "screenShotFile": "00c30079-0010-003a-00a3-0066004500fe.png",
        "timestamp": 1570798193403,
        "duration": 131079
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "854890fd203825871a9f8db543b89e44",
        "instanceId": 7948,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Enter valid form data.}\n  (Session info: chrome=77.0.3865.90): Enter valid form data.\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/table[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:324:27)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571026575317,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571026575317,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571026575595,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571026592321,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571026603479,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571026620344,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571026686843,
                "type": ""
            }
        ],
        "screenShotFile": "004f00e9-00b9-0041-00fc-006b001300c4.png",
        "timestamp": 1571026570213,
        "duration": 134542
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "ab2083306a0f6d2409a4d4110fbb68d6",
        "instanceId": 10772,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027101496,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027101496,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027101665,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027124748,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027135994,
                "type": ""
            }
        ],
        "screenShotFile": "001e004e-00c8-0062-00de-002b006600a8.png",
        "timestamp": 1571027096621,
        "duration": 46534
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "073892387235a4ea4ff6f7822e812112",
        "instanceId": 12772,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //input[@id=\"name\"])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batch (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:257:19)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:12:16)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027238359,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027238361,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027238814,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027261775,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027273720,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027292800,
                "type": ""
            }
        ],
        "timestamp": 1571027231865,
        "duration": 80918
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "609e43ec30be37eaade16613b2c62d55",
        "instanceId": 8816,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027483627,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027483627,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027483645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027507270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027519171,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571027539063,
                "type": ""
            }
        ],
        "screenShotFile": "00130068-00ab-0027-00c1-003400480048.png",
        "timestamp": 1571027479397,
        "duration": 109609
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "43bbce7e4742b55e6d88c9652de7caa0",
        "instanceId": 12960,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:376:31)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028147479,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028147479,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028147479,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028171482,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028186108,
                "type": ""
            }
        ],
        "screenShotFile": "00590090-00a7-0019-00d7-0050003700ba.png",
        "timestamp": 1571028140972,
        "duration": 61397
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "376f442fdb6ce349c41d2351d68cedec",
        "instanceId": 13208,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:398:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://fonts.googleapis.com/css?family=Roboto:300,400,500 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028234760,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fonts.googleapis.com/icon?family=Material+Icons - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028234760,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.google.com/recaptcha/api.js?render=explicit&onload=loadCaptcha - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028234982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028237374,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028237374,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028242414,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028265375,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028290071,
                "type": ""
            }
        ],
        "screenShotFile": "004400bf-00cc-008b-00b6-00ad00be007c.png",
        "timestamp": 1571028221257,
        "duration": 95636
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "a9a81c75e44107b930a84db425c79977",
        "instanceId": 13684,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: script timeout: result was not received in 11 seconds\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "ScriptTimeoutError: script timeout: result was not received in 11 seconds\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"appUserName\"])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as sendKeys] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as sendKeys] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.loginpage (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:101:19)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:10:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028360440,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028360440,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028360440,
                "type": ""
            }
        ],
        "screenShotFile": "008a00f9-004d-0012-00da-003b00c7001f.png",
        "timestamp": 1571028347000,
        "duration": 27092
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "4e8dff8524114ccbdd416a1be3a713bb",
        "instanceId": 8128,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:398:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028416698,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028416698,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028416806,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028443252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028456648,
                "type": ""
            }
        ],
        "screenShotFile": "005900b2-002b-0083-007e-00ec0027007d.png",
        "timestamp": 1571028408778,
        "duration": 86898
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "3ba386aa968d409ee4542b4e19db7592",
        "instanceId": 13732,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:398:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028570801,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028570801,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028570801,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028596329,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028607886,
                "type": ""
            }
        ],
        "screenShotFile": "00240001-00f0-009c-0088-00e100810096.png",
        "timestamp": 1571028564075,
        "duration": 89920
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "754697b7e1ce9ef49a3593a430abed41",
        "instanceId": 13636,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:403:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028786853,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028786854,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028786854,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028811127,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571028824225,
                "type": ""
            }
        ],
        "screenShotFile": "00d300c8-004b-00fa-0071-0072003f00a6.png",
        "timestamp": 1571028780748,
        "duration": 159797
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "d7c9fba77b1be6fbcff46f734ca1ca32",
        "instanceId": 5136,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[1]/zc-data-list[1]/zc-data-list-table[1]/div[1]/div[3]/div[1]/p-table[1]/div[1]/div[1]/table[1]/tbody[1]/div[1]/div[1]/div[1]/div[1]/table[1]/tbody[1]/tr[1]/td[4]/div[1]/zc-actions[1]/div[1]/i[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:403:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029076519,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029076752,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029077326,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029102770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029114815,
                "type": ""
            }
        ],
        "screenShotFile": "00da0086-0035-0050-0020-00c900ad00b0.png",
        "timestamp": 1571029070745,
        "duration": 169669
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "ecbc54eb66925c3a1cf969466b56f070",
        "instanceId": 8176,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[2]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[2]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:408:25)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029429872,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029429872,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029429873,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029456261,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029469260,
                "type": ""
            }
        ],
        "screenShotFile": "00280013-00ca-00f9-0072-0096001000b3.png",
        "timestamp": 1571029422267,
        "duration": 180026
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "81c39c8c3cb665611392944ba170d694",
        "instanceId": 964,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[2]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[2]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:408:25)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029644175,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029644178,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029644359,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029661867,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029663714,
                "type": ""
            }
        ],
        "screenShotFile": "00b1008f-009d-0062-0089-00ca00fb000e.png",
        "timestamp": 1571029640488,
        "duration": 84909
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "38943459cd3e9b6fd833825b74fcc745",
        "instanceId": 8052,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[3]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:408:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029792096,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029792096,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029792235,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029809045,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571029810981,
                "type": ""
            }
        ],
        "screenShotFile": "00f8004a-004c-0089-00ed-004500730093.png",
        "timestamp": 1571029787621,
        "duration": 85005
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "99a04d291e267d937533962d32a43f7a",
        "instanceId": 14104,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[@class='ng-tns-c13-128 ng-star-inserted'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[@class='ng-tns-c13-128 ng-star-inserted'])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:380:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571030510570,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571030521242,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571030523147,
                "type": ""
            }
        ],
        "screenShotFile": "004e003a-0007-0094-00a5-00a700780007.png",
        "timestamp": 1571030484287,
        "duration": 50146
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "d556c9c3fcc5c93135442b4a12e6f947",
        "instanceId": 12480,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: clickonsubject1 is not defined"
        ],
        "trace": [
            "ReferenceError: clickonsubject1 is not defined\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:422:9)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f300ab-0002-00a6-00e8-005d00dd0043.png",
        "timestamp": 1571032257211,
        "duration": 1211
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "19d2a3ae042f34c7f4645350b3c70dcd",
        "instanceId": 2324,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: clickonsubject1 is not defined"
        ],
        "trace": [
            "ReferenceError: clickonsubject1 is not defined\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:422:9)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "003f00de-0077-0026-00eb-00b600ae009a.png",
        "timestamp": 1571032276867,
        "duration": 1234
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "69d62e42e3d0fe10436bfc2ce7d546e2",
        "instanceId": 13556,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[@class='ng-tns-c13-128 ng-star-inserted'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[@class='ng-tns-c13-128 ng-star-inserted'])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:380:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032372166,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032372166,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032372294,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032389441,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032391715,
                "type": ""
            }
        ],
        "screenShotFile": "008e00ce-006d-0009-00e3-004000a600ac.png",
        "timestamp": 1571032367177,
        "duration": 35735
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "7ee0db921689768310fb4992dc9b402e",
        "instanceId": 228,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, .ng-tns-c13-128.ng-star-inserted.xh-highlight)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, .ng-tns-c13-128.ng-star-inserted.xh-highlight)\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:380:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032872163,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032872167,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032872331,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032890000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032893466,
                "type": ""
            }
        ],
        "screenShotFile": "0066008e-001c-006e-002e-004300be0088.png",
        "timestamp": 1571032867669,
        "duration": 35951
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "0616d4c825b38b58a183f72098b6abd6",
        "instanceId": 9332,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[1]/span[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[1]/span[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:380:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032980499,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032980499,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032980862,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571032998531,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033000444,
                "type": ""
            }
        ],
        "screenShotFile": "00000001-0068-0055-0029-007200e00051.png",
        "timestamp": 1571032975728,
        "duration": 35982
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "493bf6bb3a5ca17a67087577756f0382",
        "instanceId": 12216,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html[1]/body[1]/div[4]/div[2]/ul[1]/li[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:380:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:18)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033105739,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033105774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033105983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033122749,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033125023,
                "type": ""
            }
        ],
        "screenShotFile": "003f0034-00ed-005f-0040-000600e900be.png",
        "timestamp": 1571033100493,
        "duration": 35832
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "f845c0ee3945c067fc1c7b120df0e091",
        "instanceId": 12176,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033210085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033210085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033210247,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033227643,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571033229724,
                "type": ""
            }
        ],
        "screenShotFile": "00880057-00e6-000a-00d9-00ef00780029.png",
        "timestamp": 1571033206275,
        "duration": 89580
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "dfa5899f2fc9096b51f3c4b2d711b317",
        "instanceId": 4408,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[contains(text(),'MBA 1992-94')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[contains(text(),'MBA 1992-94')])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:314:21)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:16)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034062241,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034062281,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034062386,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034081777,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034102565,
                "type": ""
            }
        ],
        "screenShotFile": "0034005c-00c6-006b-00bf-003b00d90027.png",
        "timestamp": 1571034057957,
        "duration": 65008
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "cdd0d8fcaad673783a3b6b0ed87f3ef5",
        "instanceId": 11340,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=77.0.3865.90)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.128', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:310:29)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:16)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034196418,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034207135,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034218216,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1571034234369,
                "type": ""
            }
        ],
        "screenShotFile": "00f400a4-004d-0063-00b6-0021005c0046.png",
        "timestamp": 1571034175330,
        "duration": 114004
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "4061babe0b64c1c2c2616d608d6f7e90",
        "instanceId": 6384,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:310:29)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140302613,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140302631,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140302923,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140319611,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140330894,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140346689,
                "type": ""
            }
        ],
        "screenShotFile": "007700e5-004f-0051-00d2-00b700db000f.png",
        "timestamp": 1574140295291,
        "duration": 107075
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "83451301a90307565e5813bca3a50899",
        "instanceId": 10120,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.batchsubject (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:310:29)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:13:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140598611,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140598612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140598612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140615421,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140626615,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574140642526,
                "type": ""
            }
        ],
        "screenShotFile": "00f5006a-002f-00d3-0030-0055005900d4.png",
        "timestamp": 1574140591745,
        "duration": 106312
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "ade7bc39875a980568618071b47d65b3",
        "instanceId": 16516,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:382:31)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141070498,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141070601,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141070601,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141087184,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141102637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141122461,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141191718,
                "type": ""
            }
        ],
        "screenShotFile": "00990088-009b-005d-00ff-00da00860004.png",
        "timestamp": 1574141063147,
        "duration": 209711
    },
    {
        "description": "admin login|admin login functionality",
        "passed": true,
        "pending": false,
        "sessionId": "0d7603d27a1847c70c251a5c4d911119",
        "instanceId": 22456,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141655973,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141655973,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141656048,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141672390,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141683491,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141703005,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141772318,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574141854022,
                "type": ""
            }
        ],
        "screenShotFile": "00e40077-00d0-00fa-00cd-00e1006c0022.png",
        "timestamp": 1574141648124,
        "duration": 272112
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "fc0d601de1f1e2318aaa0bb804013e64",
        "instanceId": 9940,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.facultycreation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:120:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:15:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142018092,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142018135,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142018242,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142034983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142046010,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142065386,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142134735,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574142216267,
                "type": ""
            }
        ],
        "screenShotFile": "0067000c-0072-00b4-000d-00d0009c00d7.png",
        "timestamp": 1574142011096,
        "duration": 282403
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "e4df5e5f287e71e39ea87e85386c4ee6",
        "instanceId": 3604,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.get(http://v3icfai.zeroco.de/) - get url\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeScriptWithDescription (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:404:28)\n    at driver.wait (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:686:29)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:938:14\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: <anonymous>\n    at pollCondition (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2195:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2191:7\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2190:22\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: waiting for page to load for 10000ms\n    at scheduleWait (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at thenableWebDriverProxy.wait (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at driver.controlFlow.execute.then.then.then.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:685:32)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [],
        "timestamp": 1574143312575,
        "duration": 8479
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "8f7ecfffdbb9821bfbd37d488282d507",
        "instanceId": 17244,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: element click intercepted: Element <span>...</span> is not clickable at point (97, 172). Other element would receive the click: <span>...</span>\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: WebElement.click()\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at actionResults.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.facultycreation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:120:24)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:15:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143331015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143331015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143336535,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143347266,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143358494,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143378219,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143447510,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143529752,
                "type": ""
            }
        ],
        "screenShotFile": "005400bf-006f-00d5-001a-00d600f60030.png",
        "timestamp": 1574143323303,
        "duration": 282818
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "bb3c4298b7a664f127af2988632d507d",
        "instanceId": 19964,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //p-multiselectitem[1]/li[1]/div[1]/div[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //p-multiselectitem[1]/li[1]/div[1]/div[1])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as click] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.facultycreation (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:132:26)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:15:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143787639,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143787639,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143787747,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143804517,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143815991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143835334,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143904255,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574143985670,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144072044,
                "type": ""
            }
        ],
        "screenShotFile": "00f30008-005a-00ff-0094-009b001600ba.png",
        "timestamp": 1574143780299,
        "duration": 324189
    },
    {
        "description": "admin login|admin login functionality",
        "passed": false,
        "pending": false,
        "sessionId": "e66b38a73cf54e252aa4e2edd21521d7",
        "instanceId": 18812,
        "browser": {
            "name": "chrome"
        },
        "message": [
            "Failed: script timeout\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "ScriptTimeoutError: script timeout\n  (Session info: chrome=78.0.3904.97)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'DESKTOP-JIPFL18', ip: '192.168.100.117', os.name: 'Windows 8.1', os.arch: 'amd64', os.version: '6.3', java.version: '1.8.0_25'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //div[1]/div[1]/table[1])\n    at thenableWebDriverProxy.schedule (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:425:28)\n    at angularAppRoot.then (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:456:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at icfai.subjectChapter (C:\\Users\\PC\\Desktop\\Workspace\\Homepage.js:421:27)\n    at UserContext.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:14:19)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"admin login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:5:5)\n    at addSpecsToSuite (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PC\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\PC\\Desktop\\Workspace\\example.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:689:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:700:10)\n    at Module.load (internal/modules/cjs/loader.js:599:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:538:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144663414,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144663414,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144663565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144680432,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144691744,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144711101,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144780372,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://www.thresholdsoftvicon.jpg/ - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1574144865412,
                "type": ""
            }
        ],
        "screenShotFile": "006800e2-009f-0068-00b3-00fb008c001c.png",
        "timestamp": 1574144656121,
        "duration": 279331
    },
    {
        "description": "Excel File Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "sessionId": "c5b477a1b2381efea69af9535dc30c01",
        "instanceId": 22320,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d2008a-0034-002a-0070-004f00b300d8.png",
        "timestamp": 1575281458911,
        "duration": 9053
    },
    {
        "description": "Excel File Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "sessionId": "158807e2449e731a509c92547d53a1ed",
        "instanceId": 13472,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004f0063-002f-0095-009a-006c00b600f7.png",
        "timestamp": 1575281515051,
        "duration": 1274
    },
    {
        "description": "Excel File Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "sessionId": "3a3a37c481b9dbab1e3a5de40e5a6b0c",
        "instanceId": 8404,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b8000e-00d7-0000-00c7-00c200a7004c.png",
        "timestamp": 1575281728136,
        "duration": 1144
    },
    {
        "description": "Excel File Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "sessionId": "15b226bd746885b02d8f087a7f64c809",
        "instanceId": 20836,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c30082-0044-009f-002d-005a003900ae.png",
        "timestamp": 1575281774272,
        "duration": 1175
    },
    {
        "description": "Excel File Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "sessionId": "3b71989d5638c585c748969cdeac0914",
        "instanceId": 22356,
        "browser": {
            "name": "chrome"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00aa006e-0040-004c-000d-00c200f20022.png",
        "timestamp": 1575281846318,
        "duration": 1228
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});


    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
    });
