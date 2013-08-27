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

Randomly rearranges the order of the headers returned by the server.
