tamper
====

HTTP proxy that tampers with traffic in supposedly-harmless ways, for testing.

To specify which filters you want to apply, use the `Tamper-Req-Filters` and
`Tamper-Resp-Filters` request headers. The value of each is a JSON blob specifying
which filters are allowed or which are disallowed. If both `"allow"` and `"disallow"`
are provided, only `"allow"` will be used.

Examples:

Allow 'ShuffleHeaderOrder' and 'RandomizeHeaderCase':

    Tamper-Resp-Filters: {"allow":["ShuffleHeaderOrder","RandomizeHeaderCase"]}

Allow all filters except 'DuplicateHeaders':

    Tamper-Resp-Filters: {"disallow":["DuplicateHeaders"]}

Allow all filters:

    Tamper-Resp-Filters: {"disallow":[]}


Response Filters
====

These filters can be applied to the response before returning it to the client.

ShuffleHeaderOrder
----

Randomizes the order of response headers.

Pristine response:

    HTTP/1.0 200 OK
    Server: SimpleHTTP/0.6 Python/2.7.2
    Date: Thu, 05 Sep 2013 22:08:41 GMT
    Content-Type: text/html; charset=utf-8
    Content-Length: 3

    foo

Proxied response:

    HTTP/1.0 200 OK
    Content-Type: text/html; charset=utf-8
    Server: SimpleHTTP/0.6 Python/2.7.2
    Content-Length: 3
    Date: Thu, 05 Sep 2013 22:08:41 GMT

    foo

RandomizeHeaderCase
----

Randomizes the case of header names.

Pristine response:

    HTTP/1.0 200 OK
    Server: SimpleHTTP/0.6 Python/2.7.2
    Date: Thu, 05 Sep 2013 22:08:41 GMT
    Content-Type: text/html; charset=utf-8
    Content-Length: 3

    foo

Proxied response:

    HTTP/1.0 200 OK
    sErVer: SimpleHTTP/0.6 Python/2.7.2
    dATE: Thu, 05 Sep 2013 22:08:41 GMT
    CoNtenT-tYpe: text/html; charset=utf-8
    cOnTENt-lEnGTH: 178

    foo
