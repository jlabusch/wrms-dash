var store = require('./data_store_query'),
    util = require('wrms-dash-util');

module.exports = function(req, res, next, ctx){
    if (util.send_err_if_not_vendor(req, res, next, ctx, __filename)){
        return;
    }

    let handler = store.make_query_handler(req, res, next, ctx, __filename);

    store.query(
        util.trim  `SELECT  c.id,
                            c.org_name,
                            c.org_id,
                            s.system_id
                    FROM    contracts c
                    JOIN    contract_system_link s ON c.id=s.contract_id
                    ORDER BY c.org_name,c.id`,
        handler(data => {
            if (!Array.isArray(data)){
                data = [];
            }

            let r = {};

            data.forEach(row => {
                let o = r[row.id] || {org_id: row.org_id, systems: []};
                o.systems.push(row.system_id);
                r[row.id] = o;
            })

            return r;
        })
    );
}

