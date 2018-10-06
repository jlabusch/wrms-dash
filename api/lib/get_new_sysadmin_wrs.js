var query = require('wrms-dash-db').query,
    config = require('config'),
    util = require('wrms-dash-util');

module.exports = query.prepare(
    'new_sysadmin_wrs',
    'new_sysadmin_wrs',
    // TODO the sysadmin user account ID and other Catalyst branch IDs need to be configurable.
    function(ctx){
        let server = config.get('server'),
            wrms_details = server.wrms_details || {
                user_id: 4089,
                exclude_orgs: '37,1098'
            };
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
                    a.allocated_to_id=${wrms_details.user_id} AND
                    o.org_code not in (${wrms_details.exclude_orgs})
                    `.replace(/\s+/, ' ');
    },
    function(data, ctx, next){
        let err = util.send_err_if_not_vendor(null, null, null, ctx, __filename);
        if (err){
            next(err);
            return;
        }

        let r = [];
        if (data && data.rows && data.rows.length > 0){
            r = data.rows;
        }
        next(r);
    }
)
