var config  = require('config'),
    db      = require('./lib/db').create(),
    cache   = require('./lib/cache'),
    get_dash_context = require('./lib/context'),
    util    = require('./lib/util'),
    qf      = require('./lib/quote_funcs'),
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

function setup(method, func, handler){
    let path = ':org/:sys/:period';

    server.opts('/api' + func + '/' + path, preflight);

    server[method]('/api' + func + '/' + path, function(req, res, next){
        let ctx = get_dash_context(req);

        if (ctx.error){
            util.log(__filename, 'get_dash_context: ' + ctx.error);
            res.json({error: ctx.error});
            return;
        }

        handler(req, res, next, ctx);
    });
}

server.post('/enc', function(req, res, next){
    res.send(util.encrypt(req.body));
    next(true);
    next(false);
});

server.post('/dec', function(req, res, next){
    res.send(util.decrypt(req.body));
    next(true);
    next(false);
});

var get_pending_quotes = require('./lib/get_pending_quotes');

setup(
    'get',
    '/pending_quotes',
    get_pending_quotes(
        function(){
            return function(){
                return true;
            };
        }
    )
);

var get_quotes = require('./lib/get_quotes');

setup(
    'get',
    '/sla_quotes',
    get_quotes(
        function(context){
            return function(row){
                return qf.is_sla_quote_for_this_period(row, context);
            };
        }
    )
);

setup(
    'get',
    '/additional_quotes',
    get_quotes(
        function(context){
            return function(row){
                return qf.is_additional_quote_for_this_period(row, context);
            };
        }
    )
);

setup('get', '/mis_report', require('./lib/get_mis_report'));

setup('get', '/budget_summary', require('./lib/get_budget_summary_hack'));

setup('get', '/sla_unquoted', require('./lib/get_sla_unquoted'));

setup('get', '/new_sysadmin_wrs', require('./lib/get_new_sysadmin_wrs'));

setup('get', '/wrs_to_invoice', require('./lib/get_wrs_to_invoice'));

setup('get', '/additional_wrs_unquoted', require('./lib/get_additional_wrs_unquoted'));

//setup('get', '/combined_budgets', require('./lib/get_combined_budgets'));

setup('get', '/customer_list', require('./lib/get_customer_list'));

setup('get', '/customer', require('./lib/get_customer'));

setup('get', '/wrs_created_count', require('./lib/get_wrs_created_count'));

setup('get', '/wrs_over_time', require('./lib/get_wrs_over_time'));

setup('get', '/deployments', require('./lib/get_deployments'));

setup('get', '/users', require('./lib/get_users'));

setup('get', '/diskusage_moodle', require('./lib/get_diskusage_moodle'));

setup('get', '/availability', require('./lib/get_availability'));

setup('get', '/severity', require('./lib/get_severity'));

setup(
    'get',
    '/response_times_PLACEHOLDER',
    query.prepare('response_times', 'rtt',
        function(){
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
