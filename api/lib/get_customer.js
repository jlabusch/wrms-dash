var store = require('./data_store'),
    util = require('wrms-dash-util');

// returns {
//   result: 0,
//   org: {id, name},
//   system: {id, name}
// }
module.exports = function(req, res, next, ctx){
    let handler = store.make_query_handler(req, res, next, ctx, __filename);

    store.query(
        util.trim  `SELECT  c.id,c.org_name
                    FROM    contracts c
                    JOIN    contract_system_link cs ON c.id=cs.contract_id
                    WHERE   c.org_id=?
                    AND     cs.system_id IN (${ctx.sys.join(',')})
                    GROUP BY c.id`,
        ctx.org,
        handler(data => {
            if (!Array.isArray(data) || data.length < 1){
                util.log(__filename, 'ERROR: no name for org ' + ctx.org);
                data = [{id: ctx.org, org_name: ctx.org}];
            }
            return {
                result: 0,
                org: {id: ctx.org, name: data[0].org_name},
                system: {id: ctx.sys, name: data[0].id}
            };
        })
    );
}

