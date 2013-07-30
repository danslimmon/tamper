var util = require('util');
var net = require('net');

var optimist = require('optimist');

var LISTEN_HOST = '*';  // Bind to all available addresses
var LISTEN_PORT = 4080;


// An HTTP header (either request or response)
var Header = function(name, value) {
    var name = name;
    var value = value;

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
var server = net.createServer(function (socket) {
    var response_headers = [];

    response_headers.push(new Header('Date', 'Tue, 30 Jul 2013 02:41:02 GMT'));
    response_headers.push(new Header('Content-Type', 'text/html; charset=UTF-8'));
    response_headers.push(new Header('Connection', 'close'));

    socket.write('HTTP/1.1 200 OK\n');
    response_headers.forEach(function(element, index, array) {
        socket.write(element.protocolString() + '\n');
    });
    socket.end();
});

// Start listening
if (argv['listen-host'] == '*') {
    server.listen(argv['listen-port']);
} else {
    server.listen(argv['listen-port'], argv['listen-host']);
}

console.log(util.format('Server running at http://%s:%d/', argv['listen-host'], argv['listen-port']));
