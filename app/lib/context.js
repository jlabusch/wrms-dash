module.exports = function(req){
    let context = {};

    context.org = parseInt(req.params.org);
    if (isNaN(context.org)){
        context.org = undefined;
        context.error = "Couldn't parse org=" + req.params.org;
        return context;
    }

    if (req.params.sys.match(/^[0-9,]+$/)){
        context.sys = req.params.sys.split(/,/);
    }else{
        context.error = "Couldn't parse sys=" + req.params.sys;
        return context;
    }

    if (req.params.period.match(/^\d\d\d\d-\d\d?$/)){
        context.period = req.params.period.replace(/-0/, '-');
    }else{
        let now     = new Date(),
            YEAR    = now.getFullYear(),
            MONTH   = (now.getMonth()+1)%12;
        context.period = YEAR + '-' + MONTH;
    }

    return context;
}

