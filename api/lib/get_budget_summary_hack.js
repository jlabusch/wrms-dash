var cache = require('./cache'),
    org_data = require('./org_data'),
    util  = require('./util');

// Grovel through the cache and pull out whatever budget info we can find.
// This is a hack for the omnitool, and not used on any customer-facing pages.
module.exports = function(req, res, next, ctx){
    let result = {},
        period = util.current_period().period;
    Object.keys(cache.__raw).forEach(key => {
        let arr = key.match(/^sla_hours_api({.*})$/);
        if (arr){
            let ctx = null,
                data = cache.__raw[key].val;
            try{
                ctx = JSON.parse(arr[1]);
            }catch(ex){
                util.log(__filename, "ERROR: couldn't parse cache key [" + key + "]");
                return;
            }
            if (ctx.period !== period){
                util.log_debug(__filename, 'Skipping ' + key);
                return;
            }
            result[org_data.get_org(ctx.org).name] = data;
        }
    });
    res.charSet('utf-8');
    res.json(result);
    next && next(false);
};

