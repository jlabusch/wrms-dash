var store = require('./data_store'),
    util = require('./util');

module.exports = function(req, res, next, ctx){
    let handler = store.make_query_handler(req, res, next, ctx, __filename);

    store.query(
        util.trim  `SELECT  c.id,
                            c.org_name,
                            c.org_id
                    FROM    contracts c
                    ORDER BY c.org_name,c.id`,
        handler(data => {
            if (!Array.isArray(data)){
                data = [];
            }

            let r = {};

            data.forEach(row => {
                r[row.id] = row.org_id;
            })

            return r;
        })
    );
}

