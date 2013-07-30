var util = require('util');
var net = require('net');

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


var server = net.createServer(function (socket) {
    var response_headers = [];

    response_headers.push(new Header('Date', 'Tue, 30 Jul 2013 02:41:02 GMT'));
    response_headers.push(new Header('Content-Type', 'text/html; charset=UTF-8'));
    response_headers.push(new Header('Connection', 'close'));

    socket.write('HTTP/1.1 200 OK\n');
    for (hdr_idx in response_headers) {
        hdr = response_headers[hdr_idx];
        socket.write(hdr.protocolString() + '\n');
    }
    socket.end();
});

if (LISTEN_HOST == '*') {
    server.listen(LISTEN_PORT);
} else {
    server.listen(LISTEN_PORT, LISTEN_HOST);
}

console.log(util.format('Server running at http://%s:%d/', LISTEN_HOST, LISTEN_PORT));
