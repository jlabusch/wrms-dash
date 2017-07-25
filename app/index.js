var config  = require('config'),
    db      = require('./db').create(),
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
    server.opts(uri + '/:org/:sys', preflight);
    server[method](uri + '/:org/:sys', handler);
}

var cache = {},
    CACHE_TIMELIMIT_MS = 60*1000;

function cache_key(name, context){
    return name + JSON.stringify(context);
}

function cache_put(key, val){
    var now = new Date().getTime();
    cache[key] = {ts: now, val: val};
}

function cache_get(key){
    var now = new Date().getTime();
    var item = cache[key];
    if (item){
        if (item.ts + CACHE_TIMELIMIT_MS > now){
            console.log('cache hit [' + key + ']');
            return item.val;
        }
    }
    console.log('cache miss [' + key + ']');
    return null;
}

setup('get', '/sla_quotes', function(req, res, next){
    console.log('sla_quotes()');
    res.json({
        result: [
            {
                request_id: '217001: brief desc',
                result: 1
            },
            {
                request_id: '217002: brief but longer desc',
                result: 1
            },
            {
                request_id: '217003: some widget is not working, help',
                result: 1
            }
        ]
    });
    next && next(false);
});

setup('get', '/customer', function(req, res, next){
    let os = get_org_and_sys(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('customer(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = {
            result: 0,
            org: { id: os.org },
            system: { id: os.sys }
        };
        if (data && data.rows && data.rows.length > 0){
            if (!cache_hit){
                cache_put(cache_key('customer',os), data);
            }
            r.org.name = data.rows[0].org_name;
            r.system.name = data.rows.map(row => { return row.system_desc }).join(', ');
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('customer',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'customer', 
                `SELECT org_code,org_name,system_id,system_desc
                 FROM organisation,work_system
                 WHERE org_code=${os.org} AND system_id IN (${os.sys.join(',')})
                 `.replace(/\s+/g, ' ')
            )
            .then(
                success,
                (err) => {
                    console.log(err);
                    res.json({error: err.message});
                    next && next(false);
                }
            )
    }
});

setup('get', '/additional_quotes', function(req, res, next){
    console.log('additional_quotes()');
    res.json({
        result: [
            {
                request_id: '217004: make widgets better',
                result: 1
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
        result: 1
    });
    next && next(false);
});

setup('get', '/storage', function(req, res, next){
    console.log('storage()');
    res.json({
        result: 1
    });
    next && next(false);
});

setup('get', '/availability', function(req, res, next){
    console.log('availability()');
    res.json({
        result: 1
    });
    next && next(false);
});

setup('get', '/severity', function(req, res, next){
    let os = get_org_and_sys(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('severity(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    var urg = {
        "'Yesterday'": 3,
        "As Soon As Possible": 2,
        "Before Specified Date": 2,
        "On Specified Date": 2,
        "After Specified Date": 2,
        "Sometime soon": 1,
        "Anytime": 0
    };
    function success(data, cache_hit){
        let r = [
            [ 'Low', 0 ],
            [ 'Medium', 0 ],
            [ 'High', 0 ],
            [ 'Critical', 0 ]
        ];
        if (data && data.rows && data.rows.length > 0){
            if (!cache_hit){
                cache_put(cache_key('wr_list',os), data);
            }
            data.rows.forEach(row => {
                r[urg[row.urgency]][1]++;
            });
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wr_list',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'wr_list', 
                wr_list_sql(os.org, os.sys)
            )
            .then(
                success,
                (err) => {
                    console.log(err);
                    res.json({error: err.message});
                    next && next(false);
                }
            )
    }
});

setup('get', '/response_times', function(req, res, next){
    console.log('severity()');
    res.json({
        result: [
            [ 'Low', 1 ],
            [ 'Medium', 1 ],
            [ 'High', 1 ],
            [ 'Critical', 1 ]
        ]
    });
    next && next(false);
});

setup('get', '/statuses', function(req, res, next){
    let os = get_org_and_sys(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('statuses(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            let o = {};
            if (!cache_hit){
                cache_put(cache_key('wr_list',os), data);
            }
            data.rows.forEach(row => {
                let x = o[row.status];
                if (!x){
                    x = 0;
                }
                ++x;
                o[row.status] = x;
            });
            Object.keys(o).forEach(stat => { r.push([stat, o[stat]]); });
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wr_list',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'wr_list', 
                wr_list_sql(os.org, os.sys)
            )
            .then(
                success,
                (err) => {
                    console.log(err);
                    res.json({error: err.message});
                    next && next(false);
                }
            )
    }
    next && next(false);
});

setup('get', '/sla_hours', function(req, res, next){
    console.log('sla_hours()');
    res.json({
        budget: 1,
        result: [
            ['SLA quotes', 1],
            ['SLA unquoted', 1],
            ['Additional quotes', 1]
        ]
    });
    next && next(false);
});

function get_org_and_sys(req){
    let o = {};
    o.org = parseInt(req.params.org);
    if (isNaN(o.org)){
        o.org = undefined;
        o.error = "Couldn't parse org=" + req.params.org;
        return o;
    }
    if (req.params.sys.match(/^[0-9,]+$/)){
        o.sys = req.params.sys.split(/,/);
    }else{
        o.error = "Couldn't parse sys=" + req.params.sys;
        return o;
    }
    return o;
}

function wr_list_sql(org, sys){
    return `SELECT r.request_id,
                   r.brief,
                   stat.lookup_desc as status,
                   urg.lookup_desc as urgency
            FROM request r
            JOIN usr u ON u.user_no=r.requester_id
            JOIN lookup_code stat on stat.source_table='request'
               AND stat.source_field='status_code'
               AND stat.lookup_code=r.last_status
            JOIN lookup_code urg on urg.source_table='request'
               AND urg.source_field='urgency'
               AND urg.lookup_code=cast(r.urgency as text)
            WHERE u.org_code=${org}
               AND r.system_id in (${sys.join(',')})
               AND r.last_status not in ('F', 'C')
            ORDER BY r.urgency,r.last_status ASC`.replace(/\s+/g, ' ');
}

setup('get', '/wr_list', function(req, res, next){
    let os = get_org_and_sys(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('wr_list(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            r = data.rows;
            if (!cache_hit){
                cache_put(cache_key('wr_list',os), data);
            }
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wr_list',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'wr_list', 
                wr_list_sql(os.org, os.sys)
            )
            .then(
                success,
                (err) => {
                    console.log(err);
                    res.json({error: err.message});
                    next && next(false);
                }
            )
    }
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

