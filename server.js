var util = require('util');
var net = require('net');

var optimist = require('optimist');

//+ Jonas Raoni Soares Silva
////@ http://jsfromhell.com/array/shuffle [v1.0]
function shuffle(o) {
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
};


// An HTTP header (either request or response)
var Header = function(header_str) {
    var parts = header_str.split(': ', 2);
    var name = parts[0];
    var value = parts[1];

    return {
        // Normalizes the header's name.
        //
        // Equivalent header names will have the same normalized name.
        normalizedName: function() {
            return name.toLowerCase();
        },

        // Compares this instance's name to another's.
        //
        // Returns `true` if this's name is equivalent to that of `other` (also
        // a Header object).
        isSameHeader: function(other) {
            return (normalizedName() == other.normalizedName());
        },

        // Returns the protocol string that should be output for this header.
        //
        // E.g. for Header('Connection', 'keep-alive') this would be
        //
        //     'Connection: keep-alive'
        protocolString: function() {
            return [name, value].join(': ');
        }
    }
};


// An HTTP response.
var Response = function() {
    var data = '';
    var status_line = null;
    var headers = null;
    var body = null;

    // Parses the response data into headers and body
    var parseData = function() {
        // Break apart headers from body
        var parts = data.split('\r\n\r\n', 2);
        var headers_str = parts[0];
        body = parts[1];

        // Parse headers
        var header_lines = headers_str.split('\r\n');
        status_line = header_lines.shift();
        headers = header_lines.map(function(h_str) {
            return Header(h_str);
        });
    }

    return {
        // Adds data to the response.
        addData: function(new_data) {
            data += new_data;
        },

        // Returns an array of Header objects representing the response headers.
        getHeaders: function() {
            if (! headers) { parseData(); }
            return headers;
        },

        // Sets the response headers to the given array of Header objects
        setHeaders: function(new_headers) {
            headers = new_headers;
        },

        // Returns the whole contents of the response that should be sent over the socket.
        fullData: function() {
            resp_data = status_line + '\r\n';
            resp_data += headers.map(function(hdr) {
                return hdr.protocolString();
            }).join('\r\n');
            resp_data += '\r\n\r\n' + body;
            console.log('%j', resp_data);
            return resp_data;
        }
    }
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


// Applies filters to Response objects and sends them.
var ResponseFilterSet = function() {
    var response = null;
    var socket = null;

    return {
        setResponse: function(new_response) { response = new_response; },
        setSocket: function(new_socket) { socket = new_socket; },

        // Sends the response on the given socket.
        send: function() {
            var filt = FilterRespShuffleHeaders();
            filt.applyFilter(response);
            socket.end(response.fullData());
        }
    }
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

// Define web server
var server = net.createServer(function(client_socket) {
    var server_socket = new net.Socket();
    var response = new Response();

    server_socket.connect(argv['dest-port'], argv['dest-host']);
    client_socket.on('data', function(data) {
        server_socket.write(data);
    });
    client_socket.on('end', function(){
        server_socket.end();
    });
    server_socket.on('data', function(data) {
        response.addData(data);
    });
    server_socket.on('end', function(){
        var response_filterset = new ResponseFilterSet();
        response_filterset.setResponse(response);
        response_filterset.setSocket(client_socket);
        response_filterset.send();
    });
});

// Start listening
if (argv['listen-host'] == '*') {
    server.listen(argv['listen-port']);
} else {
    server.listen(argv['listen-port'], argv['listen-host']);
}

console.log(util.format('Server running at http://%s:%d/', argv['listen-host'], argv['listen-port']));
