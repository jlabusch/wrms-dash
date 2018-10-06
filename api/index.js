var config  = require('config'),
    cache   = require('wrms-dash-db').cache,
    db      = require('wrms-dash-db').db.create(),
    util    = require('wrms-dash-util'),
    qf      = require('./lib/quote_funcs'),
    query   = require('wrms-dash-db').query,
    restify = require('restify');

'use strict';

var server = util.server.create('wrms-dash-api');

server.post('/enc', function(req, res, next){
    res.send(util.crypt.encrypt(req.body));
    next && next(false);
});

server.post('/dec', function(req, res, next){
    res.send(util.crypt.decrypt(req.body));
    next && next(false);
});

var get_quotes = require('./lib/get_quotes');

util.server.setup('get', '/pending_quotes',     get_quotes({sla:undefined,  approved:false, limit_period:false}));
util.server.setup('get', '/sla_quotes',         get_quotes({sla:true,       approved:true,  limit_period:true }));
util.server.setup('get', '/additional_quotes',  get_quotes({sla:false,      approved:true,  limit_period:true }));

util.server.setup('get', '/mis_report', require('./lib/get_mis_report'));

util.server.setup('get', '/invoices', require('./lib/get_odoo_invoices'));

util.server.setup('get', '/sla_unquoted', require('./lib/get_sla_unquoted'));

util.server.setup('get', '/new_sysadmin_wrs', require('./lib/get_new_sysadmin_wrs'));

util.server.setup('get', '/wrs_to_invoice', require('./lib/get_wrs_to_invoice'));

util.server.setup('get', '/additional_wrs_unquoted', require('./lib/get_additional_wrs_unquoted'));

//util.server.setup('get', '/combined_budgets', require('./lib/get_combined_budgets'));

util.server.setup('get', '/customer_list', require('./lib/get_customer_list'));

util.server.setup('get', '/customer', require('./lib/get_customer'));

util.server.setup('get', '/wrs_created_count', require('./lib/get_wrs_created_count'));

util.server.setup('get', '/wrs_over_time', require('./lib/get_wrs_over_time'));

util.server.setup('get', '/deployments', require('./lib/get_deployments'));

util.server.setup('get', '/users', require('./lib/get_users'));

util.server.setup('get', '/storage', require('./lib/get_storage'));

util.server.setup('get', '/availability', require('./lib/get_availability'));

util.server.setup('get', '/fte_budgets', require('./lib/get_fte_budgets'));

util.server.setup('get', '/raw_timesheets', require('./lib/get_raw_timesheets'));

util.server.setup(
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

util.server.setup('get', '/response_times', require('./lib/get_response_times'));

util.server.setup('get', '/sla_hours', require('./lib/get_sla_hours'));

var wr_list_query = require('./lib/get_wr_list');

util.server.setup(
    'get',
    '/wr_list',
    wr_list_query({
        exclude_statuses: [],
        limit_period: true
    })
);

util.server.setup(
    'get',
    '/statuses',
    wr_list_query({
        limit_period: false,
        processor: (rows) => {
            let o = {};

            rows.forEach(r => {
                let x = o[r.status] || 0;
                ++x;
                o[r.status] = x;
            });

            let r = [];
            Object.keys(o).sort().forEach(status => { r.push([status, o[status]]) });
            return r;
        }
    })
);

util.server.setup(
    'get',
    '/severity',
    wr_list_query({
        limit_period: false,
        processor: (rows) => {
            let r = [
                [ 'Low', 0 ],
                [ 'Medium', 0 ],
                [ 'High', 0 ],
                [ 'Critical', 0 ]
            ];
            rows.forEach(row => {
                r[util.map_severity(row.urgency, row.importance).number][1]++;
            });
            return r;
        }
    })
);

util.server.main(config.get('server.listen_port'));

