var config= require('config'),
    query = require('./query'),
    qf    = require('./quote_funcs');

module.exports = function(pred){
    return query.prepare(
        'pending_quotes',
        'pending_quotes',
        (ctx) => {
            return qf.quote_sql(ctx, false);
        },
        qf.make_query_handler(pred, (key, wr_data) => {
            return {
                wr: key,
                request_id: wr_data[key].request_id,
                brief: wr_data[key].brief,
                quote_amount: Math.round(wr_data[key].quote_sum*10)/10,
                quote_units: wr_data[key].quote_units
            };
        })
    );
}

