var query = require('./query'),
    util = require('./util');

module.exports = query.prepare(
    'statuses',
    'stat',
    function(ctx){
        return util.wr_list_sql(ctx, false, ["'C'", "'F'", "'O'"])
    },
    function(data, ctx, next){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            let o = {};
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
        next(r);
    }
)
