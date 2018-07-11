var store = require('./data_store'),
    util = require('./util');

// returns {
//   result: 0,
//   org: {id, name},
//   system: {id, name}
// }
module.exports = function(req, res, next, ctx){
    store.query(
        util.trim  `SELECT  c.id,c.org_name
                    FROM    contracts c
                    JOIN    contract_system_link cs ON c.id=cs.contract_id
                    WHERE   c.org_id=?
                    AND     cs.system_id IN (${ctx.sys.join(',')})`,
        ctx.org,
        (err, data) => {
            if (err){
                util.log(__filename, 'ERROR: ' + (err.message || err));
                res.json({error: err.message});
                next && next(false);
                return;
            }
            if (!Array.isArray(data) || data.length < 1){
                util.log(__filename, 'ERROR: no name for org ' + ctx.org);
                data = [{id: ctx.org, org_name: ctx.org}];
            }
            res.charSet('utf-8');
            res.json({
                result: 0,
                org: {id: ctx.org, name: data[0].org_name},
                system: {id: ctx.sys, name: data[0].id}
            });
            next && next(false);
        }
    );
}

