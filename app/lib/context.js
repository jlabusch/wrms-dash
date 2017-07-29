var config = require('config');

module.exports = function(req){
    let context = {},
        orgs = config.get('org');

    if (typeof(orgs[req.params.org]) === 'number'){
        context.org = orgs[req.params.org];
    }else{
        context.org = parseInt(req.params.org);
    }
    if (isNaN(context.org)){
        context.org = undefined;
        context.error = "Couldn't parse org=" + req.params.org;
        return context;
    }

    if (req.params.sys === 'default'){
        context.sys = orgs[context.org].default_system.split(/,/);
    }else if (req.params.sys.match(/^[0-9,]+$/)){
        context.sys = req.params.sys.split(/,/);
    }else{
        context.error = "Couldn't parse sys=" + req.params.sys;
        return context;
    }

    if (req.params.period.match(/^\d\d\d\d-\d\d?$/)){
        context.period = req.params.period.replace(/-0/, '-');
        let s = context.period.split('-');
        context.year   = parseInt(s[0]);
        context.month  = parseInt(s[1]);
    }else{
        let now        = new Date();
        context.year   = now.getFullYear(),
        context.month  = (now.getMonth()+1)%12;
        context.period = context.year + '-' + context.month;
    }

    return context;
}

