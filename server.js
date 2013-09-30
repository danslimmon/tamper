var util = require('util');
var http = require('http');

var optimist = require('optimist');

// http://jsfromhell.com/array/shuffle [v1.0]
// Shuffles an array
function shuffle(o) {
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

function randomizeCase(s) {
    return s.split('').map(function(c) {
        return Math.floor(Math.random()*2) ? c.toUpperCase() : c.toLowerCase();
    }).join('');
}


// Filter that randomizes the order of the response headers
function FilterRespShuffleHeaders() {
    this.name = 'ShuffleHeaderOrder';
}
// Applies this filter to the given ResponseBuffer instance.
FilterRespShuffleHeaders.prototype.apply_filter = function(response_buffer) {
    response_buffer.headers = shuffle(response_buffer.headers);
}


// Filter that randomizes the case of the response header names
function FilterRespRandomizeHeaderCase() {
    this.name = 'RandomizeHeaderCase';
}
// Applies this filter to the given ResponseBuffer instance.
FilterRespRandomizeHeaderCase.prototype.apply_filter = function(response_buffer) {
    response_buffer.headers = response_buffer.headers.map(function(h) {
        return [randomizeCase(h[0]), h[1]];
    });
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

    this.availFilters = [
          new FilterRespShuffleHeaders()
        , new FilterRespRandomizeHeaderCase()
    ];
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

    var headerObj = JSON.parse(req.headers['tamper-resp-filters']);
    if ('allow' in headerObj) {
        return this.availFilters.filter(function(filt) {
            return (headerObj.allow.indexOf(filt.name) != -1);
        })
    } else if ('disallow' in headerObj) {
        return this.availFilters.filter(function(filt) {
            return (! (headerObj.disallow.indexOf(filt.name) != -1));
        })
    }

    // Got `Tamper-Resp-Filters` header, but it specifies neither 'allow' nor 'disallow'.
    // Disallow all.
    return [];
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
        possibleFilters = shuffle(possibleFilters);
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


// Staging area for what we're going to send back to the client.
function ResponseBuffer(proxy_response) {
    this.proxy_response = proxy_response;
    this.chunks = [];
    this.headers = [];
}

// Adds a chunk to be sent back to the client in the response
ResponseBuffer.prototype.add_chunk = function(chunk) {
    this.chunks.push(chunk);
}

// Writes the response data to the ClientResponse object.
ResponseBuffer.prototype.write = function(response) {
    var resp_socket = response.socket;

    // Write status line
    var status_line = "HTTP/" + this.proxy_response.httpVersion +
        " " + this.proxy_response.statusCode.toString() +
        " " + http.STATUS_CODES[this.proxy_response.statusCode];
    resp_socket.write(status_line + "\n");

    // Write headers
    var header_blob = "";
    for (var header_ind in this.headers) {
        header_blob += this.headers[header_ind][0] + ": " + this.headers[header_ind][1] + "\n";
    }
    resp_socket.write(header_blob + "\n");

    // Write body
    for (var chunk_ind in this.chunks) {
        resp_socket.write(this.chunks[chunk_ind]);
    }
}

// Changes the response header names' case to that sent by the target server.
//
// @param parser - An http.HTTPParser instance with headers populated already
ResponseBuffer.prototype.populateHeaders = function(parser) {
    // parser.headers is a list of alternating header names and header values.
    for (var i = 0; i < parser.headers.length; i += 2) {
        this.headers.push([parser.headers[i], parser.headers[i+1]]);
    }
}


function startListening(port, host) {

    var httpServer = new http.Server();
    httpServer.listen(port, host);
    httpServer.on('request', function(request, response) {
        var response_buffer = new ResponseBuffer();
        var proxy_request = http.request({hostname: argv['dest-host'],
                                          port: argv['dest-port'],
                                          method: request.method,
                                          path: request.url,
                                          headers: request.headers,
                                         });

        proxy_request.on('socket', function(socket) {
            // This is how we get at the header names with their original case
            // and order before the HTTP parser lowercases and disorders them.
            var old_onHeadersComplete = proxy_request.parser.onHeadersComplete;
            proxy_request.parser.onHeadersComplete = function(info) {
                response_buffer.populateHeaders(info);
                if (old_onHeadersComplete !== undefined) {
                    return old_onHeadersComplete.apply(this, arguments);
                }
            };
        });

        proxy_request.on('response', function (proxy_response) {
            response_buffer.proxy_response = proxy_response;

            proxy_response.on('data', function(chunk) {
                response_buffer.add_chunk(chunk, 'binary');
            });

            proxy_response.addListener('end', function() {
                var rfp = new ResponseFilterPicker();
                var filters = rfp.pick(request, proxy_response);
                for (filt_index in filters) {
                    filters[filt_index].apply_filter(response_buffer)
                }

                response_buffer.write(response);
                response.socket.end();
            });
        });

        request.on('data', function(chunk) {
            proxy_request.write(chunk, 'binary');
        });
        request.on('end', function() {
            proxy_request.end();
        });

    });
}

// Start listening
if (argv['listen-host'] == '*') {
    startListening(argv['listen-port']);
} else {
    startListening(argv['listen-port'], argv['listen-host']);
}

console.log(util.format('Server running at http://%s:%d/', argv['listen-host'], argv['listen-port']));
