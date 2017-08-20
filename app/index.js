var config  = require('config'),
    db      = require('./lib/db').create(),
    cache   = require('./lib/cache'),
    get_dash_context = require('./lib/context'),
    util    = require('./lib/util'),
    query   = require('./lib/query'),
    restify = require('restify');

'use strict';

const GENERIC_ERROR = {error: 'Service interruption - please try again later'};

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
    util.log(__filename, err.stack);
    res.send(500, GENERIC_ERROR);
});

function preflight(req, res, next){
    res.send(200);
    return next();
}

function parse_auth(s){
    if (!s){
        return null;
    }

    let parts = s.match(/([^:\/]+).(.+)/);
    if (!parts){
        return null;
    }

    return {user: parts[1], pass: parts[2]};
}

function check_auth(header, ctx){
    let parts = header.match(/basic\s+([^ ]+)/i),
        result = false;

    if (parts){
        let o = util.orgs[ctx.org];

        let server_creds = parse_auth(config.get('server.password'), ctx),
            org_creds = o.name && o.password ? parse_auth(o.password) : null,
            req_creds = parse_auth(new Buffer(parts[1], 'base64').toString());

        if (req_creds){
            if (req_creds.user === server_creds.user){
                // If we're staff, we see everything
                result = req_creds.pass === server_creds.pass;
            }else{
                // If we're a customer, we only see our org.
                // That implies config(orgs).password exists.
                result = org_creds &&
                         req_creds.user === org_creds.user &&
                         req_creds.pass === org_creds.pass;
            }
            util.log(__filename, req_creds.user + ' access for org ' + ctx.org + ' -> ' + result);
        }
    }
    return result;
}

function setup(method, uri, handler){
    server.opts('/api' + uri + '/:org/:sys/:period', preflight);

    server[method]('/api' + uri + '/:org/:sys/:period', function(req, res, next){
        let ctx = get_dash_context(req);

        if (ctx.error){
            util.log(__filename, 'get_dash_context: ' + ctx.error);
            res.json({error: ctx.error});
            return;
        }

        if (req.headers.authorization && check_auth(req.headers.authorization, ctx)){
            handler(req, res, next, ctx);
        }else{
            res.send(401);
            next && next(false);
        }
    });
}

server.post('/enc', function(req, res, next){
    res.send(util.encrypt(req.body));
    next && next(false);
});

server.post('/dec', function(req, res, next){
    res.send(util.decrypt(req.body));
    next && next(false);
});

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
        function(context){
            return function(row){
                return util.is_additional_quote(row, context);
            }
        }
    )
);

setup('get', '/sla_unquoted', require('./lib/get_sla_unquoted'));

setup('get', '/customer_list', require('./lib/get_customer_list'));

setup('get', '/customer', require('./lib/get_customer'));

setup('get', '/wrs_created_count', require('./lib/get_wrs_created_count'));

setup('get', '/wrs_over_time', require('./lib/get_wrs_over_time'));

setup('get', '/deployments', require('./lib/get_deployments'));

setup('get', '/users', function(req, res, next){
    util.log(__filename, 'users()');
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
        util.log(__filename, `${server.name} listening at ${server.url}`);
    });
}

if (require.main === module){
    main(config.get('server.listen_port'));
}

exports.run = main;
