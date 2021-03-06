/*global IMPORTS, libraries, Mojo, MojoLoader, log, iCal, vCard, logToApp, SyncMLAccount, DeviceProperties, KeyManager */

try {
  console.error("Starting to load libraries");
  var Foundations = IMPORTS.foundations;
  var Future = Foundations.Control.Future; // Futures library
	var DB = Foundations.Data.DB;  // db8 wrapper library
	var PalmCall = Foundations.Comms.PalmCall;
  //var AjaxCall = Foundations.Comms.AjaxCall;
  var Calendar = IMPORTS.calendar; 
  var Contacts = IMPORTS.contacts; 
  var path = IMPORTS.require('path');
  var fs = IMPORTS.require('fs');
  //for "local" AjaxCall fix:
  var urlModule = IMPORTS.require('url');
  var httpModule = IMPORTS.require('http');
  var bufferModule = IMPORTS.require('buffer');
  var Err = Foundations.Err;

  try {
    var stats = fs.statSync("/media/internal/.info.mobo.syncml.log");
    if (stats.size > 2097152) {
      console.error("Moving log file, size was " + stats.size);
      fs.renameSync("/media/internal/.info.mobo.syncml.log","/media/internal/.info.mobo.syncml.log.old");
    }
  } catch (error) {
    console.error("No logfile present, yet? " + error);
  }
  
	console.error("--------->Loaded Libraries OK");
} catch (Error) {
  console.error("Error during loading libraries: " + Error);
}

var locked = false;
var previousOperationFuture = new Future();
var syncingAccountIds = {};
var outerFutures = [];

//params: outerFuture, result, accountId, name
var finishAssistant_global = function(p) {
  //log ("Finish Assistant called with " + p.name + ", " + p.accountId + ", " + JSON.stringify(p.result));
  previousOperationFuture.result = {go: true};
  if (p.name === "onDeleteAssistant" ||
      p.name === "onCreateAssistant" ||
      p.name === "onEnabledAssistant") {
    locked = false;
  }
  p.outerFuture.result = p.result;
  if (p.accountId) {
    if (syncingAccountIds[p.accountId]) {
      syncingAccountIds[p.accountId].outerFuture.result = p.result;
      delete syncingAccountIds[p.accountId]; //release lock.
    }
  }
};

//params: name, outerFuture, accountId
var startAssistant = function(params) {
  if (params.name === "syncAssistant") {
    if (params.accountId) {
      if (syncingAccountIds[params.accountId] && syncingAccountIds[params.accountId].syncing === true) {
        log("Already syncing account " + params.accountId + ". Waiting until that is finished and will then return.");
        syncingAccountIds[params.accountId].outerFuture = params.outerFuture;
        return false;
      } else {
        log("Locking account " + params.accountId + " to prevent multiple syncs.");
        syncingAccountIds[params.accountId] = {syncing: true, outerFuture: params.outerFuture};
        return true;
      }
    }
  } else {
    if (params.name === "onDeleteAssistant" ||
        params.name === "onCreateAssistant" ||
        params.name === "onEnabledAssistant") {
      if (locked === true) {
        log("Already doing account operation, waiting until it's finished.");
        previousOperationFuture.then(this, function (f) {
          log("PreviousOperation finished " + JSON.stringify(f.result) + " , starting " + params.name);
          params.run(params.outerFuture);
        });
        return false;
      }
      else {
        locked = true;
      }
    }
  }
  return true;
};

var stream;
var log = function (logmsg) {
	console.error(logmsg);
	try {
	  if (typeof stream === "undefined") {
	    stream = fs.createWriteStream("/media/internal/.info.mobo.syncml.log", {flags:"a"});
	  }
	  stream.write(new Date() + ": " + logmsg + "\n");
	  //stream.end();
	} catch(e) {
	  console.error("Unable to write to file: " + e);
	}
};

var logError_global = function (error, name) {
  if(!name && arguments && arguments.callee && arguments.callee.caller && arguments.callee.caller.name) {
    name = arguments.callee.caller.name;
  }
  log("Exception in " + name);
  log("Complete exception: " + JSON.stringify(error));
  logToApp(error.name + ": " + error.message + ", operation stopped in " + name);
};

var logError_lib = function (error) {
  var i;
  logError_global(error);
  for (i = 0; i < outerFutures.length; i += 1) {
    outerFutures[i].result = { returnValue: false, finalResult: true, success: false, reason: "Exception " + error.name + ": " + error.message};
  }
  syncingAccountIds = {}; //release sync lock.
  throw error; //this will stop the service from processing..?
  //process.exit(-1); don't do that. App won't get our results.. *sigh*
};

process.on("uncaughtException",function(e) {
  log("Uncaought error!!!");
  logError_lib(e);
});

var logSubscription;
var logToApp = function (logmsg) {
  log("==============================================");
  log("To App: " + logmsg);
  log("==============================================");
  if (!logSubscription || ! logmsg) {
    log("Could not log to app: " + logSubscription + " and " + logmsg);
    return;
  }
  var f = logSubscription.get();
  f.result = { msg: logmsg };
};

//simple logging - requires target HTML element with id of "targOutput"
var logGUI = function (controller, logInfo) {
	console.error(logInfo);
	logInfo = "" + logInfo;
	logInfo = logInfo.replace(/</g, "&lt;");
	logInfo = logInfo.replace(/>/g, "&gt;");
	this.targOutput = controller.get("logOutput");
	this.targOutput.innerHTML =  logInfo + "<br/>" + this.targOutput.innerHTML;
};

var fresult = {};
var initialize = function(params) {
  var future = new Future(), innerFuture = new Future(fresult), initFinishCheck, initAccounts, future_, res;
  log("initialize helper, status: " + JSON.stringify(fresult));
  if (params.iCal) {
    iCal.intitialize(innerFuture);
  }
    
  if (params.vCard) {
    vCard.initialize(innerFuture);
  }
  
  if (params.accounts) {
    params.keymanager = true;
  }
  
  initAccounts = function (f) {
    log("Init Accounts");
    var i = 0, gotAccountInfo;
    gotAccountInfo = function(future) {
      if (!future.result.returnValue) {
        log("Could not get account info.");
      }
      i -= 1;
      log("Got account info " + i);
      if (i === 0) {
        var res = f.result;
        res.accounts = true;
        f.result = res;
      }
    };
    
    log("Starting findAccounts");
    SyncMLAccount.findAccounts().then(this, function (future) {
      var account, res;
      log("Got accounts: " + future.result.returnValue);
      log("Accounts finished.");
      if (params.accountsInfo) {
        account = SyncMLAccount.getAccount();
        while (account) {
          if (account.accountId) {
            log("Getting account info " + i);
            SyncMLAccount.getAccountInfo(account).then(this, gotAccountInfo);
            i += 1;
          }
          account = SyncMLAccount.getNextAccount();
        }
      }
      if (i === 0) {
        res = f.result;
        if (!res) {
          res = {};
        }
        res.accounts = true;
        f.result = res;
      }
    });
  };
  
  //checks if all inner init functions are finished. Only then it will set a result for the outer future.
  initFinishCheck = function (f) {
    if (f.result) {
      fresult = f.result;
      if (((params.iCal && f.result.iCal) || !params.iCal) && 
          ((params.devID && f.result.devID) || !params.devID) && 
          ((params.keymanager && f.result.keymanager) || !params.keymanager) && 
          ((params.accounts && f.result.accounts) || !params.accounts) &&
          ((params.vCard && f.result.vCard) || !params.vCard)
          ) {
        //finished. :)
        log ("Init of all parts finished.");
        future.result = { returnValue: true};
      } else {
        log("Init not finished yet " + JSON.stringify(f.result));
        f.then(this, initFinishCheck);
        
        if (f.result.keymanager && !f.result.accounts && params.accounts) {
          initAccounts(innerFuture);
        }
      }
    }
  };
  
  //get devide id:
  if (params.devID && !fresult.devID) {
    if (!DeviceProperties.devID) {
      future_ = PalmCall.call('palm://com.palm.preferences/systemProperties', "Get", {"key": "com.palm.properties.nduid" });
      future_.then(function (f) {
        var res;
        if (f.result.returnValue === true) {
          DeviceProperties.devID = f.result["com.palm.properties.nduid"];
          log("Got deviceId: " + DeviceProperties.devID);
          res = innerFuture.result;
          res.devID = true;
          innerFuture.result = res;
        } else {
          log("Could not get device id: " + JSON.stringify(f.result));
        }
      });
      future_.onError(function (f) {
        log("Error in getDeviceID-future: " + f.exeption);
        logToApp("Could not get device id: " + JSON.stringify(f.exeption));
        future_.result = { returnValue: false };
      });
    } else {
      log("DeviceID still present");
      res = innerFuture.result;
      res.devID = true;
      innerFuture.result = res;
    }
  }
  
  if (params.keymanager && !fresult.keymanager) {
    KeyManager.initialize(innerFuture);
  }
  
  innerFuture.then(this, initFinishCheck);
  return future;
};

//own AjaxCall, because it is broken in webOS 2.2.4
var ajaxCallPost = function (url, body, options) {
  var method = "POST", parsed, secure, port, httpClient, headers = {}, bodyEncoding, i, requestPath, local_result, request;
  return new Future().now(this, function(future) {
    options = options || {};
    // console.log("Options: " + JSON.stringify(options));
    method = method.toUpperCase();
    
    /*if (body && method !== AjaxCall.RequestMethod.POST)
    {
      if (url.match("\\?")) {
        url = url + "&" + body;
      } else {
        url = url + "?" + body;
      }
      body = undefined;
    }*/
    
    if (options.customRequest) {
      method = options.customRequest;
      method = method.toUpperCase();
    }
    //console.log("method = " + method);
    
    
    /*
     * First we set up the http client.
     */
    parsed = urlModule.parse(url);
    secure = (parsed.protocol === 'https:');
    port = parsed.port;
    if (!port) {
      port = (secure) ? 443 : 80;
    }
    
    // console.log("SECURE="+secure);
    // console.log("parsed = "+JSON.stringify(parsed));
    httpClient = httpModule.createClient(port, parsed.hostname, secure);
    httpClient.addListener('error', function clientError(error) {
      future.exception = Err.create(error.errno, "httpClient error "+error.message);
    });
    
    
    /*
     * Then we set up the http request.
     */
    // Add all the generic headers that are always needed
    headers.host = parsed.host;
    // TODO: add support for deflate and gzip encodings, and handle 'nocompression' option
    headers["Accept-Encoding"] = "identity";// "deflate, gzip";
    bodyEncoding = (options.bodyEncoding === "ascii" ? "ascii" : "utf8");
    if (bodyEncoding === 'ascii') {
      headers["Content-Length"] = (body && body.length) || 0;
    } else {
      headers["Content-Length"] = (body && bufferModule.Buffer.byteLength(body)) || 0;
    }
    headers.Accept = "*/*";
    headers['Content-Type'] = "application/x-www-form-urlencoded";
    headers.Date = (new Date()).toUTCString();
    
    // TODO: Add "expect 100" support for large POST operations?
    
    // Allow the caller to set/override any headers they want
    Object.keys(options.headers || {}).forEach(function (headerName) {
      headers[headerName] = options.headers[headerName];
    });
    // console.log("Headers: " + JSON.stringify(headers));
    
    if (options.joinableHeaders) {
      for (i = 0; i < options.joinableHeaders.length; ++i) {
        httpClient.palm_markHeaderJoinable(options.joinableHeaders[i]);
      }
    }
    
    // console.log("pathname=" + parsed.pathname);
    requestPath = parsed.pathname || "/";
    if (parsed.search) {
      requestPath = requestPath + parsed.search;
    }
    
    local_result = { responseText: "" };
    // console.log("requesting path: " + requestPath);
    request = httpClient.request(method, requestPath, headers);
    request.addListener('error', function requestError(error) {
      future.exception = Err.create(error.errno, "httpRequest error "+error.message);
    });
    
    /*
     * Set up the response handler for the request.
     */
    request.addListener('response', function returnResponse(response) {
      // console.log("Response headers: " + JSON.stringify(response.headers));
      
      /*
       * Handle the data we have now - the status code and the headers
       */
      future._response = response;
      local_result.status = response.statusCode;
      local_result.getResponseHeader = function(name) {
        return response.headers[name.toLowerCase()];
      };
      local_result.getAllResponseHeaders = function(name) {
        if (!local_result.allHeaders) {
          // Concat all the headers together as a string if they
          // haven't already been
          var headers = [], key;
          for (key in response.headers) {
            if (response.headers.hasOwnProperty(key)) {
              headers.push("" + key + ": " + response.headers[key]);
            }
          }
          local_result.allHeaders = headers.join('\r\n');
        }
        return local_result.allHeaders;
      };
      //if the caller passed an onResponse function, call it with the status code and response headers
      if (options.onResponse && typeof options.onResponse === "function") {
        options.onResponse(response.statusCode, response.headers);
      }
      
      
      /*
       * Add handlers for the "data", "error", and "end" events
       */
      response.addListener('data', function addToResponseText(chunk) {
        local_result.responseText += chunk;
        
        //if the caller passed an onData function, call it with the current chunk of data
        if (options.onData && typeof options.onData === "function") {
          options.onData(chunk);
        }
      });
      
      response.addListener('error', function responseError(error) {
        future.exception = Err.create(error.errno, "httpResponse error " + error.message);
      });
      
      response.addListener('end', function requestDone() {
        try {
          local_result.responseJSON = JSON.parse(local_result.responseText);
        } catch (parseError) {
          //ignore errors while parsing the response as JSON - it must not be a JSON response
        }
        future.result = local_result;
      });
    });
    
    // console.log("Body (" + bodyEncoding + ", " + headers["Content-Length"] + "): " + body);
    request.end(body, bodyEncoding);
  });
};

var checkActivities = function (account) {
  if (account && account.syncInterval && account.syncInterval !== "disabled") {
    try {
    var activityType = {
                //foreground: true,
                background: true, //try background. Idea: user does something in calendar, and as soon as she finishes, push that to server.
                //immediate: true,
                //priority: "low",
                pausable: false, //we don't like to be paused, after all that is communication with the server. :(
                cancellable: false, //that is even worse!
                //power: true, //do we really need that?
                //powerDebounce: true,
                explicit: true, //let's try it this way.. hm.
                persist: true //we want to keep that activity around!
              },
      activityCallback = {
                  method: "palm://info.mobo.syncml.client.service/sync",
                  params: { accountId: account.accountId } //prevent password and so on from being stored in another DB. AccountID is sufficient here.
                };

    log("Account.datastores: " + JSON.stringify(account.datastores));                
    
    //calendar watch:
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".watchCalendar.delayed" }).then(function(f) {
      log("Cancelled Calendar Watch delayed activity for " + account.name + ".");
    });
    
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".watchCalendar" }).then(function(f) {
      log("Cancelled Calendar Watch activity for " + account.name + ".");
      if (!account.datastores.calendar || !account.datastores.calendar.enabled || !account.dbWatch) { //watch disabled currently, because of issues.. :(
        log("Calendar watch activity not necessary, all ok.");
      } else {
        var activityCal = {
            name: "info.mobo.syncml:" + account.name + ".watchCalendar",
            description: "Synergy SyncML calendar changes Watch",
            type: activityType,
            requirements: {
              internetConfidence: "excellent"
            },
            trigger: { method: "palm://com.palm.db/watch", key: "fired",
              params: { subscribe: true, query: {
                  from: "info.mobo.syncml.calendarevent:1",  //it's necessary that the comparison with _rev is at index 1 to update the rev value in complete.
                  where: [ {prop: "accountId", op: "=", val: account.accountId}, { prop: "_rev", op: ">", val: account.datastores.calendar.lastRev || 0 } ],	incDel: true}}},
            callback: activityCallback
        };
        log("(Re-)Adding calendar-Watch activity");
        PalmCall.call("palm://com.palm.activitymanager/", "create", { start: true, activity: activityCal }).then(function (f1) {
          log("WatchCalendar Sync for " + account.name + " created.");
          log(JSON.stringify(f1.result));
        });
      }
    });
    
    //contacts watch:
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".watchContacts.delayed" }).then(function(f) {
      log("Cancelled Contacts Watch delayed activity for " + account.name + ".");
    });
   
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".watchContacts" }).then(function(f) {
      log("Cancelled Contacts Watch activity for " + account.name + ".");
      if (!account.datastores.contacts || !account.datastores.contacts.enabled || !account.dbWatch) {
        log("Contact watch activity not necessary, all fine.");
      } else {
        log("Adding contacts-Watch activity");
        var activityCon = {
            name: "info.mobo.syncml:" + account.name + ".watchContacts",
            description: "Synergy SyncML contact changes Watch",
            type: activityType,
            requirements: {
              internetConfidence: "excellent"
            },
            trigger: { method: "palm://com.palm.db/watch", key: "fired",
                params: { subscribe: true, query: {
                  from: "info.mobo.syncml.contact:1", //it's necessary that the comparison with _rev is at index 1 to update the rev value in complete.
                  where: [ {prop: "accountId", op: "=", val: account.accountId}, { prop: "_rev", op: ">", val: account.datastores.contacts.lastRev || 0 } ],	incDel: true}}},
            callback: activityCallback
        };
        PalmCall.call("palm://com.palm.activitymanager/", "create", { start: true, activity: activityCon }).then(function (f1) {
          log("WatchContacts Sync for " + account.name + " created.");
          log(JSON.stringify(f1.result));
        });
      }
    });
    
    //periodic sync:
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".periodic" }).then(function(f) {
      log("Cancelled periodic Watch activity for " + account.name + ".");
      if ((account.datastores.calendar && account.datastores.calendar.enabled) || 
          (account.datastores.contacts && account.datastores.contacts.enabled)) {
        log("Adding periodic activity");
        var activityPeriod = {
            name: "info.mobo.syncml:" + account.name + ".periodic",
            description: "Synergy SyncML periodic sync",
            type: activityType,
            requirements: {
              internetConfidence: "excellent"
            },
            schedule: { interval: account.syncInterval },
            callback: activityCallback
        };
        PalmCall.call("palm://com.palm.activitymanager/", "create", { start: true, activity: activityPeriod }).then(function (f1) {
          log("Periodic Sync for " + account.name + " created.");
          log(JSON.stringify(f1.result));
        });
      } else {
        log("Not doing anything, do not need periodic activity.");
      }
    });

    log("Create activity callbacks called.");
    } catch (e) {
      log("Error in createAcitivities: " + e);
    }
  } else {
    log("Automatic Sync not activated.");
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".watchCalendar" }).then(function(f) {
      log("Cancelled Calendar Watch activity for " + account.name + ".");
    });
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".watchContacts" }).then(function(f) {
      log("Cancelled Contacts Watch activity for " + account.name + ".");
    });
    PalmCall.call("palm://com.palm.activitymanager/", "cancel", { activityName: "info.mobo.syncml:" + account.name + ".periodic" }).then(function(f) {
      log("Cancelled periodic Watch activity for " + account.name + ".");
    });
  }
};

//do a deep copy. 
var moboCopy = function(source) {
  var target = {}, name, s;
  if (source) {
    for (name in source) {
      if (source.hasOwnProperty(name)) {
        s = source[name];
        if (typeof s === "object") {
          target[name] = moboCopy(s);
        } else {
          target[name] = s;
        }
      }
    }
  }
  return target;
};
