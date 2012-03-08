//Welcome to the zoo!

var src = '';

var Lazy   = require('lazy');
var fs     = require('fs');
var colors = require('colors');


var FileParser = function (){
    "use strict";
    var self       = this;
    var jsonstart  = '<!-';
    var jsonend    = '->';
    var jsonstring = '';
    var bodystring = '';

    var mark = {
        ENUM : {
            NONE: 0,
            START: 1,
            BODY: 2
        }
    };
    mark.state = mark.ENUM.BODY;

    var readLine = function(line){
        console.log("LZ: " + typeof Lazy);

        var entire = line.toString(); // this part may fail! 
        var body = entire.substring(entire.indexOf("{") + 1, entire.lastIndexOf("}"));
        console.log("BD: " + body);

        //console.log("RL: " + typeof line);
        //console.log("RL: " + typeof line + ":" + line === '\r');
        var tstr = line.toString();
        //tstr = tstr.replace(/^\s+|\s+$/g, '') ;
        //var tstr = String.fromCharCode.apply(String, line);
        //console.log(tstr + ':' + jsonstart + ':' + tstr.indexOf(jsonstart)>=0);
        //console.log(mark.state + ':' + tstr + ':' + jsonstart + ':' + tstr.indexOf(jsonstart));

        if(tstr.indexOf(jsonstart)!==-1) {
            mark.state = mark.ENUM.START;
        } else if (tstr.indexOf(jsonend)!==-1 && mark.state === mark.ENUM.START){
            mark.state = mark.ENUM.BODY;
        } else {
            switch(mark.state){
                case mark.ENUM.START:
                    jsonstring += tstr;
                break;
                case mark.ENUM.BODY:
                    bodystring += tstr;
                break;
            }
        }
    };

    self.parseFile = function (path, callback){
        var lz = new Lazy(fs.createReadStream(path))
            .lines.map(String).forEach(readLine);

        lz.join(function () {
            callback(jsonstring, bodystring);
        });
    };
};


var Fragment = function (path){
    "use strict";
    var self      = this;
    self.path     = path;
    self.rawbody  = '';
    self.json     = undefined;
    self.body     = {};
    self.readyCB  = undefined;
    self.envelope = undefined;
    self.state    = {
        envelope : false,
        body     : false,
        isRaw    : false
    };

    var testReady = function(){
        if(self.state.envelope && self.state.body){
            console.log(path + " is ready".green);
            //console.log(path + ":env: " + self.envelope);
            //console.log(path + ":bod: " + JSON.stringify(self.body, null, '\t'));
            self.readyCB();
        }
    };
    var envelopeCB = function(){
        self.state.envelope = true;
        testReady();
    };
    var readEnvelope = function () {
        if(self.json.envelope){
            self.envelope = new Fragment(self.json.envelope);
            self.envelope.parse(envelopeCB);
        }
    };
    var readArrays = function (){
        var obj;
        
        var FgmtCtr = function (initialCt){
            var slf = this;
            var fragmentCtr = initialCt;
            slf.decAndCountFragments = function(){
               --fragmentCtr;
               if(fragmentCtr === 0){
                   self.state.body = true;
                   testReady();
               }
            };
        };
        var FgmtHandler = function (ctrObj){
            var slf = this;
            var fragmentCtr = ctrObj;
            slf.handle = function(ref){
               if(self.body[obj] === undefined ){
                   self.body[obj] = {};
               }
               if('text' === ref){
                   self.body[obj][ref] = self.rawbody;
                   fragmentCtr.decAndCountFragments();
               } else {
                   self.body[obj][ref] = new Fragment(ref);
                   self.body[obj][ref].parse(fragmentCtr.decAndCountFragments);
               }
            };
        };
        for(obj in self.json){
            if(self.json.hasOwnProperty(obj)){
                if(self.json[obj] instanceof Array){
                    var fragmentCtr = new FgmtCtr(self.json[obj].length);
                    var fragmentHdl = new FgmtHandler(fragmentCtr);
                    self.json[obj].forEach(fragmentHdl.handle);
                }
            }
        }
    };

    var handleJSON = function (jsonString){
        if(jsonString && jsonString.length>0){
            var aJSON = JSON.parse(jsonString);
            if(aJSON){  
                self.json = aJSON; 
                readEnvelope();
                readArrays();
            } else {
                throw ("unable to parse JSON: " + jsonString);
            }
        } else {
            console.log(path + " no json");
            self.state.envelope = true;
            self.state.body = true;
            if(self.rawbody.length > 0){
                self.state.isRaw = true;
            }
            testReady();
        }
    };

    var fileParsedCB = function (jsonString, bodyString){
        console.log(self.path + " fileParsedCB");
        self.rawbody = bodyString;
        handleJSON(jsonString);
    };

    self.parse = function(callback){
        console.log(self.path + " parse called");
        self.readyCB = callback;
        var fp = new FileParser();
        fp.parseFile(path, fileParsedCB);
    };

    self.debugString = function(childString){
        childString = childString.replace(new RegExp(/\n/g), '\n\t');
       
        var lString = '';
        var obj; 
        var iobj;
        var checkAndInsertNewline = function (host, attach){
            if(host && host.length>0) {
                return host + '\n' + attach;
            }

            return attach;
        };
        //if i have a populated body, process it.
        for(obj in self.body){
            if(self.body.hasOwnProperty(obj)){
                for(iobj in self.body[obj]){
                    if(self.body[obj].hasOwnProperty(iobj)){
                        if('text' === iobj){
                            lString = checkAndInsertNewline(lString,self.body[obj][iobj]);
                        } else {
                            if (self.body[obj][iobj] instanceof Fragment){
                                lString = checkAndInsertNewline(lString,self.body[obj][iobj].debugString('leaf'));
                            }
                        }
                    }
                }
            }
        }

        //if i have an envelope..process it
        if(self.envelope){
            lString = self.envelope.debugString(lString);
        } 

        //if i have no envelop or body, just print out the raw file text.
        if(self.state.isRaw){
            lString = self.rawbody;
        }
       
        //console.log("bds: " + path + lString + childString);

        //return the results
        return lString + '\n' + childString;
    };

    self.generate = function(root){
        var bodyString = '';

        if(self.envelope){
            bodyString += self.envelope.generate();
        }
        
        for(var obj in self.body){
            var segment = '';
            for(var iobj in self.body[obj]){
                if('text' === iobj){
                    segment += self.body[obj][iobj];
                } else {
                    if (self.body[obj][iobj] instanceof Fragment){
                        segment += self.body[obj][iobj].generate();
                    }
                }
            }

            bodyString = bodyString.replace(obj, segment);
        }

        if(self.state.isRaw){
            bodyString = self.rawbody;
        }

        return bodyString;
    };
};

var root = new Fragment("./testtwo.html");
var rootCallback = function(){
    //use strict";
    console.log("im the parent");
    var dStr = root.debugString("root");
    console.log("ods:" + dStr);
    console.log(root.generate());
};
root.parse(rootCallback);
