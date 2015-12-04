#!/usr/bin/env node
var path = require('path'),
    fs = require('fs'),
    Promise = require('bluebird'),
    hapi = require('hapi'),
    nconf = require('nconf');

var server = new hapi.Server();
nconf
    .argv()
    .defaults({
        'dir':  '.',
        'port': 3000,
        'notes': 'preview/notes_filler',
        'parts-file': null,
        'reveal-mode': false
    });

var parts = null,
    connected = 0;
if (nconf.get('parts-file')) {
    parts = fs.readFileSync(nconf.get('parts-file'), 'utf8').split('\n').filter(function(x) { return x && x.length > 0; });
}

server.connection({
    port: nconf.get('port')
});

server.register(
    [
        require('inert'),
        require('nes'),
        require('blipp')
    ],
    function() {
        var previewDirectory = 'preview';
        if (nconf.get('reveal-mode')) {
            previewDirectory = path.join(previewDirectory, 'reveal.js');
        }

        server.ext('onPreResponse', function(request, reply) {
            var response = request.response;
            if (response &&
                response.statusCode === 200 && (
                    response.source &&
                    response.source.path &&
                    response.source.path.lastIndexOf('index.html') === response.source.path.length - 'index.html'.length
                ) || request.path === '/notes/'
            ) {
                return reply(new Promise(function(resolve, reject) {
                    fs.readFile(response.source.path, 'utf8', function(err, content) {
                        var offset = request.query.offset || null;
                        content = content
                            .replace('<head>',
                            '<head>\n' +
                            '<script src="/inject/modules/nes/lib/client.js"></script>\n' +
                            '<script src="/inject/ws_client.js"></script>\n' +
                            '<script>loadClient(' + offset + ', ' + nconf.get('reveal-mode') + ');</script>');
                        if (typeof request.query.preview != 'undefined') {
                            content = content
                                .replace('<head>',
                                '<head>\n' +
                                '<style>\n' +
                                'body { zoom: ' + request.query.preview + '; }\n' +
                                '</style>');
                        }

                        resolve(content);
                    });
                }));
            } else {
                return reply.continue();
            }
        });

        server.route({
            method: 'GET',
            path:   '/inject/modules/{path*}',
            handler: {
                directory: {
                    path: './node_modules'
                }
            }
        });

        server.route({
            method: 'GET',
            path:   '/inject/{path*}',
            handler: {
                directory: {
                    path: './inject'
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/next',
            handler: function(request, reply) {
                server.publish('/next');
                return reply();
            }
        });

        server.route({
            method: 'GET',
            path: '/previous',
            handler: function(request, reply) {
                server.publish('/previous');
                return reply();
            }
        });

        server.route({
            method: 'GET',
            path: '/goto/{slide}',
            handler: function(request, reply) {
                server.publish('/goto', { slide: decodeURIComponent(request.params.slide) });
                return reply();
            }
        });

        server.route({
            method: 'GET',
            path: '/parts',
            handler: function(request, reply) {
                return reply(parts);
            }
        });

        server.route({
            method: 'POST',
            path: '/status',
            handler: function(request, reply) {
                server.publish('/initialize', request.payload);
                return reply();
            }
        });

        server.route({
            method: 'GET',
            path: '/{path*}',
            handler: {
                directory: {
                    path: nconf.get('dir'),
                    redirectToSlash: true,
                    lookupCompressed: true
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/notes/{path*}',
            handler: {
                directory: {
                    path: nconf.get('notes'),
                    redirectToSlash: true,
                    lookupCompressed: true
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/preview/{path*}',
            handler: {
                directory: {
                    path: previewDirectory,
                    redirectToSlash: true,
                    lookupCompressed: true
                }
            }
        });

        server.subscription('/initialize', {
            onSubscribe: function() {
                if (connected > 0) {
                    server.publish('/status');
                } else {
                    server.publish('/initialize');
                }
            }
        });
        server.subscription('/status');

        server.subscription('/next', {
            onSubscribe: function() {
                connected++;
            },
            onUnsubscribe: function() {
                connected--;
            }
        });
        server.subscription('/previous');
        server.subscription('/goto');
    }
);

server.start(function(err) {
    console.log('Server started');
});
