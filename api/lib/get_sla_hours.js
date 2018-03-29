var query = require('./query'),
    http  = require('http'),
    config= require('config'),
    cache = require('./cache'),
    qf    = require('./quote_funcs'),
    util  = require('./util');

const HOURS = 60*60*1000,
      DEBUG = false;

function build_sql(ctx){
    // TODO: use the string_agg() trick to avoid multiple rows for multiple tags.
    // See get_quotes.js.
    return `SELECT r.request_id,r.brief,r.invoice_to,SUM(ts.work_quantity) AS hours,otag.tag_description as tag
            FROM request r
            JOIN request_timesheet ts ON r.request_id=ts.request_id
            LEFT JOIN request_tag rtag ON r.request_id=rtag.request_id
            LEFT JOIN organisation_tag otag ON otag.tag_id=rtag.tag_id
            JOIN usr u ON u.user_no=r.requester_id
            WHERE u.org_code=${ctx.org}
                AND r.system_id IN (${ctx.sys.join(',')})
                AND ts.work_on >= '${ctx.period + '-01'}'
                AND ts.work_on < '${util.next_period(ctx) + '-01'}'
                AND ts.work_units='hours'
            GROUP BY r.request_id,otag.tag_description`;
}

function populate_timesheets(data, ctx){
    let ts = {},
        warranty_wrs = {};

    data.rows.forEach(row => {
        // Don't add hours if we find a Warranty tag.
        if (row.tag === 'Warranty'){
            warranty_wrs[row.request_id] = true;
            delete ts[row.request_id];
        }else if (!warranty_wrs[row.request_id]){
            ts[row.request_id] = row;
            ts[row.request_id].total = util.calculate_timesheet_hours(row.hours, row.invoice_to, ctx);
        }
    });

    util.log_debug(__filename, JSON.stringify(ts, null, 2), DEBUG);
    return ts;
}

function process(pending_quotes, approved_quotes, ts, budget, ctx, next){
    let sla = 0,
        add = 0;

    if (!Array.isArray(pending_quotes.rows)){
        util.log(__filename, "pending_quotes.rows is not an array: " + JSON.stringify(pending_quotes, null, 2));
        next({error: "Couldn't calculate SLA breakdown"});
        return;
    }
    if (config.get('server.wrms_details').free_presales){
        // Delete timesheets if there has ever been any kind of quote,
        // even if it's unapproved or for a different month.
        pending_quotes.rows.forEach(row => {
            delete ts[row.request_id];
            util.log_debug(__filename, 'deleting timesheets for ' + row.request_id + ', it has a pending quote', DEBUG);
        });
    }

    if (!Array.isArray(approved_quotes.rows)){
        util.log(__filename, "approved_quotes.rows is not an array: " + JSON.stringify(approved_quotes, null, 2));
        next({error: "Couldn't calculate SLA breakdown"});
        return;
    }
    // Delete more timesheets as above, and also tally up SLA/Additional quote totals
    approved_quotes.rows.forEach(row => {
        if (qf.is_sla_quote_for_this_period(row, ctx)){
            sla += qf.convert_quote_amount(row);
        }else if (qf.is_additional_quote_for_this_period(row, ctx)){
            add += qf.convert_quote_amount(row);
        }
        delete ts[row.request_id];
        util.log_debug(__filename, 'deleting timesheets for ' + row.request_id + ', it has an approved quote', DEBUG);
    });
    util.log_debug(__filename, JSON.stringify(ts, null, 2), DEBUG);

    cache.put(cache.key('sla_hours_ts',ctx), ts);

    // Sum up total unquoted hours
    let t = Object.keys(ts).reduce((acc, val) => {
        return acc + ts[val].total;
    }, 0);
    util.log_debug(__filename, 'sum of unquoted SLA hours: ' + t, DEBUG);

    let res = {
        budget: budget,
        result: [
            ['SLA quotes', sla],
            ['SLA unquoted', t],
            ['Additional quotes', add]
        ]
    };

    cache.put(cache.key('sla_hours_api',ctx), res);
    next(res);
}

function all(){
    return function(){
        return true;
    }
}

function int_req_handler(key, next){
    return function(){
        let d = cache.get(key);
        util.log_debug(__filename, 'IR handler "' + key + '" cache get: ' + JSON.stringify(d, null, 2), DEBUG);
        if (d){
            next(d);
        }else{
            next({error: "Couldn't calculate SLA breakdown"});
        }
    }
}

module.exports = query.prepare({
    label: 'sla_hours',
    cache_key_base: 'sla_hours',
    sql: build_sql,
    process_data: function(data, ctx, next){
        let ts = {};
        if (data && Array.isArray(data.rows)){
            ts = populate_timesheets(data, ctx);
        }

        let budget = 0;
        if (util.get_org(ctx) && util.get_org(ctx).budget_hours){
            budget = util.get_org(ctx).budget_hours;
        }
        util.log_debug(__filename, 'budget => ' + budget, DEBUG);

        let send_internal_request = require('./internal_request');

        cache.wait(cache.key('approved_quotes', ctx))
            .then(get_pending_quotes)
            .use_last_known_good(true)
            .timeout(() => {
                send_internal_request(
                    require('./get_quotes')(all),
                    ctx,
                    int_req_handler(cache.key('approved_quotes', ctx), get_pending_quotes)
                );
            })
            .limit(2);

        function get_pending_quotes(aq){
            let calculate_result = function(pq){
                process(pq, aq, ts, budget, ctx, next);
            }

            cache.wait(cache.key('pending_quotes', ctx))
                .then(calculate_result)
                .use_last_known_good(true)
                .timeout(() => {
                    send_internal_request(
                        require('./get_pending_quotes')(all),
                        ctx,
                        int_req_handler(cache.key('pending_quotes', ctx), calculate_result)
                    );
                })
                .limit(2);
        }
    },
    use_last_known_good: true
});

