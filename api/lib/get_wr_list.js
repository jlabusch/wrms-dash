var query = require('./query'),
    util = require('./util');

module.exports = query.prepare(
    'wr_list',
    'wr_list-ltd-allstat',
    function(ctx){
        return util.wr_list_sql(ctx, true, [])
    },
    function(data, ctx, next){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            r = data.rows;
        }
        next(r);
    }
)
