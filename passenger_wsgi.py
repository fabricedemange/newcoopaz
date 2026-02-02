# This file tells Passenger that this is a Node.js application
# and points to the startup file

import os

INTERP = "/usr/bin/node"
if os.path.isfile(INTERP):
    pass

def application(environ, start_response):
    start_response('200 OK', [('Content-Type', 'text/plain')])
    return [b"Node.js application - see app.js"]
