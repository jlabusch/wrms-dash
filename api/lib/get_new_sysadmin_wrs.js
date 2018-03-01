var query = require('./query'),
    util = require('./util');

module.exports = query.prepare(
    'new_sysadmin_wrs',
    'new_sysadmin_wrs',
    // TODO the sysadmin user account ID and other Catalyst branch IDs need to be configurable.
    function(ctx){
        return `SELECT r.request_id,
                       r.brief,
                       current_date - r.request_on::date AS age,
                       (SELECT count(*) FROM request_note n WHERE n.request_id=r.request_id) AS activity,
                       o.org_name AS org,
                       o.orG_CODe AS org_id
                FROM request r
                LEFT JOIN request_allocated a ON
                    a.request_id=r.request_id
                JOIN org_system s ON
                    s.system_id=r.system_id
                JOIN organisation o ON
                    o.org_code=s.org_code
                WHERE
                    r.last_status='N' AND
                    a.allocated_to_id=4089 AND
                    o.org_code not in (37,1098)
                    `.replace(/\s+/, ' ');
    },
    function(data, ctx, next){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            r = data.rows;
        }
        next(r);
    }
)
