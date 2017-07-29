var query = require('./query'),
    config = require('config');

module.exports = query.prepare(
    'customer_list',
    'cust_list', 
    null,
    function(data, ctx, next){
        let r = {};
        Object.keys(data).forEach(k => {
            r[k] = data[k].id;
        });
        next(r);
    },
    function(ck, ctx, good, bad){
        process.nextTick(() => { good(config.get('orgs')) });
    },
    10*1000
)
