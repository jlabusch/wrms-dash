var util = require('./util'),
    odata = require('./org_data');

'use strict';

module.exports = function(req){
    let context = {};

    let sys_arg = req.params.sys.match(/^[0-9,]+$/) ? req.params.sys.split(',') : 'default';

    const org = odata.active().get_org(req.params.org, sys_arg);

    if (!org){
        context.error = "Couldn't parse org=" + req.params.org;
        return context;
    }

    context.org = org.org_id;
    context.org_name = org.org_name;
    context.sys = org.systems;
    context.tz = org.tz || 'Europe/London';

    let p = util.parse_period(req.params.period);
    if (p){
        ['year', 'month', 'period'].forEach(x => { context[x] = p[x]; });
    }else{
        let cp = util.current_period();
        context.year   = cp.year;
        context.month  = cp.month;
        context.period = cp.period;
    }

    return context;
}

