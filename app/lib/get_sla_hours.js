var config= require('config'),
    query = require('./query'),
    http  = require('http'),
    cache = require('./cache'),
    util  = require('./util');

const HOURS = 60*60*1000;

module.exports = query.prepare(
    'sla_hours',
    'sla_hours',
    function(ctx){
        return `SELECT r.request_id,SUM(ts.work_quantity) AS hours
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
                    AND (otag.tag_description IS NULL OR otag.tag_description != 'Warranty')
                GROUP BY r.request_id`;
    },
    function(data, ctx, next){
        let ts = {};
        if (data && data.rows && data.rows.length > 0){
            data.rows.forEach(row => {
                ts[row.request_id] = row.hours;
            });
        }
        let budget = 0,
            sla_uri = config.get('sla_uri'),
            sla_config = cache.get('sla_config', 1*HOURS);
        if (sla_config){ // If we have cached SLA config, use that
            if (sla_config[ctx.org] && sla_config[ctx.org].monthly){
                budget = sla_config[ctx.org].monthly;
            }
            produce_result();
        }else if (sla_uri){ // If we can get SLA config, do that
            let hrq = http.request(sla_uri, (hresp) => {
                if (hresp.statusCode !== 200){
                    console.log('sla_hours: request to ' + sla_uri + ' failed: ' + hresp.statusCode);
                    produce_result();
                    return;
                }
                let d = '';
                hresp.on('data', chunk => { d += chunk });
                hresp.on('end', () => {
                    let json = {};
                    try{
                        json = JSON.parse(d);
                        cache.put('sla_config', json);
                    }catch(ex){
                        console.log('sla_hours: ' + ex);
                    }
                    if (json[ctx.org] && json[ctx.org].monthly){
                        budget = json[ctx.org].monthly;
                    }
                    produce_result();
                });
            });
            hrq.on('error', err => {
                console.log('sla_hours: ' + err);
                produce_result();
            });
            hrq.end();
        }else{ // Oh well, no budget
            produce_result();
        }
        function produce_result(){
            cache.wait(cache.key('approved_quotes',ctx))
                .then((aq) => {
                    let sla = 0,
                        add = 0;
                    aq.rows.forEach(row => {
                        if (util.is_sla_quote(row, ctx)){
                            sla += util.convert_quote_amount(row);
                            delete ts[row.request_id];
                        }else if (!util.is_sla_quote(row, ctx, true) && exlude_additional_quote_statuses.indexOf(row.last_status) < 0){
                            add += util.convert_quote_amount(row);
                            delete ts[row.request_id];
                        }
                    });
                    let t = Object.keys(ts).reduce((acc, val) => {
                        return acc + ts[val];
                    }, 0);
                    next({
                        budget: budget,
                        result: [
                            ['SLA quotes', sla],
                            ['SLA unquoted', t],
                            ['Additional quotes', add]
                        ]
                    });
                })
                .timeout(() => {
                    next({
                        budget: 0,
                        result: [
                            ['SLA quotes', 0],
                            ['SLA unquoted', 0],
                            ['Additional quotes', 0]
                        ]
                    });
                });
        }
    }
);

