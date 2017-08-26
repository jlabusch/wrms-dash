var query = require('./query'),
    util = require('./util');

module.exports = query.prepare(
    'severity',
    'sev',
    function(ctx){
        return util.wr_list_sql(ctx, false, ["'C'", "'F'", "'O'"])
    },
    function(data, ctx, next){
        let r = [
            [ 'Low', 0 ],
            [ 'Medium', 0 ],
            [ 'High', 0 ],
            [ 'Critical', 0 ]
        ];
        if (data && data.rows && data.rows.length > 0){
            data.rows.forEach(row => {
                r[util.map_severity(row.urgency, row.importance).number][1]++;
            });
        }
        next(r);
    }
)
