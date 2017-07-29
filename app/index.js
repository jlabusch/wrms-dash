var config  = require('config'),
    db      = require('./lib/db').create(),
    cache   = require('./lib/cache'),
    util    = require('./lib/util'),
    get_dash_context = require('./lib/context'),
    query   = require('./lib/query'),
    restify = require('restify');

'use strict';

const GENERIC_ERROR = {error: 'Service interruption - please try again later'};

function _L(f){
    return require('path').basename(__filename) + '#' + f + ' - ';
}

var server = restify.createServer({
    name: 'wrms-dash-api',
    versions: [config.get('server.version')]
});

server.use(function _cors(req, res, next){
    res.setHeader('Access-Control-Allow-Origin', '*');
    let m = req.headers['access-control-request-method'];
    if (m)  res.setHeader('Access-Control-Allow-Methods', m);
    let h = req.headers['access-control-request-headers'];
    if (h)  res.setHeader('Access-Control-Allow-Headers', h);
    return next();
});

server.use(restify.bodyParser({mapParams: true}));
server.use(restify.queryParser({mapParams: true}));

server.on('uncaughtException', (req, res, route, err) => {
    console.log('restify.uncaughtException - ' + err.stack);
    res.send(500, GENERIC_ERROR);
});

function preflight(req, res, next){
    res.send(200);
    return next();
}

function setup(method, uri, handler){
    server.opts(uri + '/:org/:sys/:period', preflight);
    server[method](uri + '/:org/:sys/:period', handler);
}

var get_quotes = require('./lib/get_quotes');

setup(
    'get',
    '/sla_quotes',
    get_quotes(
        function(context){
            return function(row){
                return util.is_sla_quote(row, context);
            }
        }
    )
);

setup(
    'get',
    '/additional_quotes',
    get_quotes(
        function(){
            return function(row){
                return util.exclude_additional_quote_statuses.indexOf(row.last_status) < 0 &&
                    (!row.invoice_to || row.invoice_to.indexOf(row.quote_id) < 0);
            }
        }
    )
);

setup('get', '/customer', require('./lib/get_customer'));

setup('get', '/wrs_created_count', require('./lib/get_wrs_created_count'));

setup('get', '/users', function(req, res, next){
    console.log('users()');
    res.json({
        result: 0
    });
    next && next(false);
});

setup('get', '/storage', require('./lib/get_storage'));

setup('get', '/availability', require('./lib/get_availability'));

setup('get', '/severity', require('./lib/get_severity'));

setup(
    'get',
    '/response_times_PLACEHOLDER',
    query.prepare('response_times', 'rtt',
        function(ctx){
            return 'select 1';
        },
        function(data, ctx, next){
            next({result: []});
        }
    )
);

setup('get', '/response_times', require('./lib/get_response_times'));

setup('get', '/statuses', require('./lib/get_statuses'));

setup('get', '/sla_hours', require('./lib/get_sla_hours'));

setup('get', '/wr_list', require('./lib/get_wr_list'));

function main(port){
    server.listen(port, function(err){
        if (err){
            throw err;
        }
        console.log(_L('listen') + '%s listening at %s', server.name, server.url);
    });
}

if (require.main === module){
    main(config.get('server.listen_port'));
}

exports.run = main;

