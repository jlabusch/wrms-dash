var config  = require('config'),
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
    server.opts(uri, preflight);
    server[method](uri, handler);
}

setup('get', '/sla_quotes', function(req, res, next){
    console.log('sla_quotes()');
    res.json({
        result: [
            {
                request_id: '217001: brief desc',
                result: 4
            },
            {
                request_id: '217002: brief but longer desc',
                result: 2
            },
            {
                request_id: '217003: some widget is not working, help',
                result: 16
            }
        ]
    });
    next && next(false);
});

setup('get', '/additional_quotes', function(req, res, next){
    console.log('additional_quotes()');
    res.json({
        result: [
            {
                request_id: '217004: make widgets better',
                result: 3
            }
        ]
    });
    next && next(false);
});

let dummy_wr_counter = 0;
setup('get', '/wrs_created_count', function(req, res, next){
    console.log('wrs_created_count()');
    res.json({
        result: ++dummy_wr_counter
    });
    next && next(false);
});

setup('get', '/users', function(req, res, next){
    console.log('users()');
    res.json({
        result: 23899
    });
    next && next(false);
});

setup('get', '/storage', function(req, res, next){
    console.log('storage()');
    res.json({
        result: 144
    });
    next && next(false);
});

setup('get', '/availability', function(req, res, next){
    console.log('availability()');
    res.json({
        result: 99.98
    });
    next && next(false);
});

setup('get', '/severity', function(req, res, next){
    console.log('severity()');
    res.json({
        result: [
            [ 'Low', 3 ],
            [ 'Medium', 3 ],
            [ 'High', 1 ],
            [ 'Critical', 0 ]
        ]
    });
    next && next(false);
});

setup('get', '/response_times', function(req, res, next){
    console.log('severity()');
    res.json({
        result: [
            [ 'Low', 13 ],
            [ 'Medium', 7 ],
            [ 'High', 4 ],
            [ 'Critical', 2 ]
        ]
    });
    next && next(false);
});

setup('get', '/statuses', function(req, res, next){
    console.log('statuses()');
    res.json({
        result: [
            [ 'New request', 3 ],
            [ 'Need Info', 1 ],
            [ 'Quote approved', 1 ],
            [ 'In progress', 2 ],
            [ 'Testing/Signoff', 1 ]
        ]
    });
    next && next(false);
});

let dummy_sla_hours_unquoted = 0;
setup('get', '/sla_hours', function(req, res, next){
    console.log('sla_hours()');
    dummy_sla_hours_unquoted += 0.25;
    res.json({
        budget: 24,
        result: [
            ['SLA quotes', 22],
            ['SLA unquoted', dummy_sla_hours_unquoted],
            ['Additional quotes', 3]
        ]
    });
    next && next(false);
});

setup('get', '/wr_list', function(req, res, next){
    console.log('wr_list()');
    res.json({
        result: [
            { request_id: 'WR 217001', brief: 'brief desc', status: 'New request', severity: 'Medium' },
            { request_id: 'WR 217002', brief: 'brief but longer desc', status: 'New request', severity: 'Medium' },
            { request_id: 'WR 217003', brief: 'some widget is not working, help', status: 'New request', severity: 'Medium' },
        ]
    });
    next && next(false);
});

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

