var util = require('util');
var http = require('http');

var optimist = require('optimist');

// http://jsfromhell.com/array/shuffle [v1.0]
// Shuffles an array
function shuffle(o) {
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
};


// Filter that randomizes the order of the response headers
var FilterRespShuffleHeaders = function() {
    return {
        // Applies this filter to the given Response instance.
        applyFilter: function(response) {
            var headers = response.getHeaders();
            var new_headers = headers.slice(0);

            // Shuffle `new_headers` until it's different
            while (headers.reduce(function(s, h) {return s + h.normalizedName();}, '') ==
                   new_headers.reduce(function(s, h) {return s + h.normalizedName();}, '')) {
                new_headers = shuffle(new_headers);
            }

            response.setHeaders(new_headers);
        }
    }
}


// Responsible for determining which filters to apply to the outgoing
// response.
//
// This is only based on incoming headers, but will eventually allow for
// command-line arguments and analysis of the  response-from-target-server
// as well.
//
// @param maxFilters: The number of filters to return, at most, from pick().
// @param retainOrder: Whether to process the filters in the order they were specified.
//      Otherwise they'll be processed in random order.
var ResponseFilterPicker = function(numToPick, retainOrder) {
    this.numToPick = typeof(numToPick) !== 'undefined' ? numToPick : 3;
    this.retainOrder = typeof(retainOrder) !== 'undefined' ? retainOrder : false;

    this.availFilters = [FilterRespShuffleHeaders];
}

// Determines which response filters are allowed by the given request.
//
// This is based on the request header called `Tamper-Resp-Filters`. If it's
// absent, then any filter is allowed. Otherwise, it's best to 
// explain with examples:
//
//      Allow 'ShuffleHeaderOrder' and 'RandomizeHeaderCase':
//          Tamper-Resp-Filters: {"allow":["ShuffleHeaderOrder","RandomizeHeaderCase"]}
//
//      Allow all filters except 'DuplicateHeaders':
//          Tamper-Resp-Filters: {"disallow":["DuplicateHeaders"]}
//
//      Any filter is allowed (the 'disallow' list is empty):
//          Tamper-Resp-Filters: {"disallow":[]}
//
// If 'allow' and 'disallow' are both provided, only 'allow' will be used.
ResponseFilterPicker.prototype._filtersAllowedByRequest = function(req) {
    if (! ('tamper-resp-filters' in req.headers)) { return this.availFilters.slice(0) }
    
    var headerObj = JSON.parse(req.headers('tamper-resp-filters'));
    if ('allow' in headerObj) {
        return this.availFilters.filter(function(filt) {
            return (filt.name in headerObj.allow);
        })
    } else if ('disallow' in headerObj) {
        return this.availFilters.filter(function(filt) {
            return (! (filt.name in headerObj.disallow));
        })
    }

    throw "Got `Tamper-Resp-Filters` header, but it specifies neither 'allow' nor 'disallow'";
}

// Determines the list of filters allowed by the given request and response.
ResponseFilterPicker.prototype._filtersAllowed = function(req, res) {
    var allowedByRequest = this._filtersAllowedByRequest(req);
    return allowedByRequest;
}

// Picks the filters to run, given a request (from the client) and a response
// (from the server).
//
// Returns an array of Filter classes.
ResponseFilterPicker.prototype.pick = function(req, res) {
    var possibleFilters = this._filtersAllowed(req, res);

    if (! this.retainOrder) {
        possibleFilters = possibleFilters.shuffle();
    }
    return possibleFilters.slice(0, this.numToPick);
}


// Process command-line arguments.
var argv = optimist
    .usage('Proxies requests and tampers with them in supposedly-acceptable ways.\n\nUSAGE: node server.js [--listen-host HOST] [--listen-port PORT] [--dest-host HOST] [--dest-port PORT]')
    .describe('listen-host', 'Listen on the host HOST')
    .describe('listen-port', 'Listen on the port PORT')
    .describe('dest-host', 'Proxy to the host HOST')
    .describe('dest-port', 'Proxy to the port PORT')
    .default('listen-host', '*')
    .default('listen-port', 4080)
    .default('dest-host', 'localhost')
    .default('dest-port', 80)
    .argv;
if (argv['help'] || argv['h']) {
    optimist.showHelp();
    process.exit();
}


function startListening(port, host) {
    httpServer = new http.Server();
    httpServer.listen(port, host);
    httpServer.on('request', function(req, res) {
        console.log(req);
        console.log(res);
    });
}

// Start listening
if (argv['listen-host'] == '*') {
    startListening(argv['listen-port']);
} else {
    startListening(argv['listen-port'], argv['listen-host']);
}

console.log(util.format('Server running at http://%s:%d/', argv['listen-host'], argv['listen-port']));
