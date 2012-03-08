
var src = '';

var lazy      = require('lazy');
var fs        = require('fs');


var FileParser = function (){
    var self = this;
    var jsonstart = '<!-';
    var jsonend   = '->';
    var jsonstring = new String();
    var bodystring = new String();

    var mark = {
        ENUM : {
            NONE: 0,
            START: 1,
            BODY: 2
        }
    };
    mark.state = mark.ENUM.NONE;

    var readLine = function(line){
        var tstr = line.toString();
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
        var lz = new lazy(fs.createReadStream(path))
            .lines.forEach(readLine);

        lz.join(function () {
            callback(jsonstring, bodystring);
        });
    };
};


var Fragment = function (path){
    var self      = this;
    self.path     = path;
    self.rawbody  = new String();
    self.json     = undefined;
    self.body     = {};
    self.readyCB  = undefined;
    self.envelope = undefined;
    self.state    = {
        envelope : false,
        body     : false
    };

    var testReady = function(){
        if(self.state.envelope && self.state.body){
            console.log(path + " is ready");
            console.log(path + ":env: " + self.envelope);
            console.log(path + ":bod: " + JSON.stringify(self.body, null, '\t'));
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
        for(obj in self.json){
            if(self.json[obj] instanceof Array){
                var fragmentCtr = self.json[obj].length;
                self.json[obj].forEach(function (ref){
                    if(self.body[obj] === undefined ){
                        self.body[obj] = new Object();
                    }
                    if('text' === ref){
                        self.body[obj][ref] = self.rawbody;
                        --fragmentCtr;
                    } else {
                        self.body[obj][ref] = new Fragment(ref);
                        self.body[obj][ref].parse(function(){
                            --fragmentCtr;
                            if(fragmentCtr === 0){
                                self.state.body = true;
                                testReady();
                            }
                        });
                    }
                });
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
            console.log("no json");
            self.state.envelope = true;
            self.state.body = true;
            testReady();
        }

    };

    var fileParsedCB = function (jsonString, bodyString){
        console.log("filecb on " + self.path);
        self.rawbody = bodyString;
        handleJSON(jsonString);
    };

    self.parse = function(callback){
        console.log("parse called on " + self.path);
        self.readyCB = callback;
        var fp = new FileParser();
        fp.parseFile(path, fileParsedCB);
    };

    self.debugString = function(childString){
        console.log(path + ":" + self.body);
        childString = path + '\n\t' + childString.replace(new RegExp(/\n/g), '\n\t')
        if(self.envelope){
            self.envelope.debugString(childString);
        } else {
            console.log("DEBUG STRING:\n" + childString);
        }
        for(obj in self.body){
            if (self.body[obj] instanceof Fragment){
                self.body[obj].debugString('leaf');
            }
        }
    };
}

var root = new Fragment("./testtwo.html");
var rootCallback = function(){
    console.log("im the parent");
    root.debugString("root");
}
root.parse(rootCallback);









/*
var Fragment = function (json, body) {
    self.json = json;
    self.body = body;
    json.val = [];

    var readFragment = function (path, callback) {
        console.log('path' + path);
        var fragment = '';
        var lzy = new lazy(fs.createReadStream(path))
        .lines
        .forEach(function(text){
            fragment += text.toString();
        });

        lzy.join(function (xs){
            callback(path, fragment);
        });
    };

    self.aString = function () {
        console.log(json);
        console.log(body);
    }

    var doDone = function(){
        if(json.val.length === json.set.length){
            console.log(json.set);
            console.log(json.val);
        }
    }

    var handleFragment = function (path, fragment){
        var idx = json.set.indexOf(path);
        json.val[idx] = fragment;

        doDone();
    }

    var handleEnvelope = function (path, fragment){
        self.envelope = new Fragment();
    }

    self.readSet = function () {
        if(json.set){
            json.set.forEach(function (key){
                if(key === 'self'){
                    handleFragment(key, body);
                } else {
                    readFragment(key, handleFragment);
                }
            });
        }
    };

    self.readEnvelope = function () {
        if(json.envelope){
            readFragment(json.envelope, handleEnvelope); 
        }
    };
}

var firstPass = function (aJSON){
    var fmt = new Fragment(aJSON, bodystring);
    fmt.aString();
    fmt.readSet();
    fmt.readEnvelope();
}

var handleJSON = function (jsonString) {
    var aJSON = JSON.parse(jsonString);
    if(aJSON){  
        firstPass(aJSON); 
    }
}


var lazier = new lazy(fs.createReadStream('./testtwo.html'))
.lines
.forEach(readLine);

lazier.join(function (xs){
    handleJSON(jsonstring);
});
*/
