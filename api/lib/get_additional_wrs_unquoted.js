var store = require('./data_store'),
    sync  = require('./data_sync'),
    odata = require('./org_data'),
    util  = require('./util');

module.exports = function(req, res, next, ctx){
    let handler = store.make_query_handler(req, res, next, ctx, __filename);

    let org = odata.get_org(ctx);

    store.query(
        util.trim  `SELECT  w.id AS request_id,
                            w.brief,
                            c.org_name AS org,
                            c.org_id,
                            w.status,
                            w.hours as worked,
                            w.tag_additional,
                            q.valid,
                            q.id as quote_id
                    FROM wrs w
                    JOIN contract_system_link cs ON cs.system_id=w.system_id
                    JOIN contracts c ON c.id=cs.contract_id
                    LEFT JOIN quotes q ON q.wr_id=w.id
                    WHERE w.tag_additional = 1 AND w.status != 'Cancelled'
                    ORDER BY w.id`,
        handler(data => {
            if (!Array.isArray(data) || data.length < 1){
                throw new Error("couldn't determine unquoted Additional WRs");
            }

            util.log_debug(__filename, 'raw data: ' + JSON.stringify(data, null, 2));

            let r = {};

            data.forEach(d => {
                let v = r[d.request_id] || d;
                v.valid = v.valid || d.valid;
                r[d.request_id] = v;
            });

            // Return only entries with hours worked but no valid quotes
            // Note that if something has both the Additional tag and a Maintenance/Warranty
            // tag then it won't be included because we won't know about hours worked.
            return Object.values(r).filter(v => { return !v.valid && v.worked > 0 });
        })
    );
}


