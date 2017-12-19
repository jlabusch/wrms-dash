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
        qf.make_query_handler(pred)
    );
}

