var query = require('./query'),
    util  = require('./util'),
    qf    = require('./quote_funcs');

module.exports = function(pred){
    return query.prepare({
        label: 'approved_quotes',
        cache_key_base: 'approved_quotes',
        sql: (ctx) => {
            return qf.quote_sql(ctx, true);
        },
        process_data: qf.make_query_handler(pred, (key, wr_data) => {
            return {wr: key, result: Math.round(wr_data[key].quote_sum*10)/10};
        }),
        use_last_known_good: true
    });
}

