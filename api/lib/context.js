var config = require('config'),
    util = require('./util');

module.exports = function(req){
    let context = {};

    if (util.orgs[req.params.org]){
        context.org = util.orgs[req.params.org].id;
    }else{
        context.org = parseInt(req.params.org);
    }
    if (isNaN(context.org)){
        context.org = undefined;
        context.error = "Couldn't parse org=" + req.params.org;
        return context;
    }

    if (req.params.sys === 'default'){
        if (util.orgs[context.org] && util.orgs[context.org].default_system){
            context.sys = util.orgs[context.org].default_system.split(/,/);
        }else{
            context.error = "No default system for org=" + req.params.org;
            return context;
        }
    }else if (req.params.sys.match(/^[0-9,]+$/)){
        context.sys = req.params.sys.split(/,/);
    }else{
        context.error = "Couldn't parse sys=" + req.params.sys;
        return context;
    }

    let p = util.parse_period(req.params.period);
    if (p){
        ['year', 'month', 'period'].forEach(x => { context[x] = p[x]; });
    }else{
        let now        = new Date();
        context.year   = now.getFullYear(),
        context.month  = (now.getMonth()+1)%12;
        context.period = context.year + '-' + context.month;
    }

    return context;
}

