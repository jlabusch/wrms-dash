var query = require('./query'),
    org_data = require('./org_data'),
    util = require('./util');

module.exports = query.prepare(
    'additional_wrs_unquoted',
    'additional_wrs_unquoted',
    function(ctx){
        return `SELECT r.request_id,
                       r.brief,
                       o.org_name AS org,
                       o.org_code AS org_id,
                       c.lookup_desc AS status,
                       SUM(t.work_quantity) as worked,
                       CASE WHEN q.quote_units = 'days' THEN q.quote_amount*8
                            ELSE q.quote_amount
                       END AS quote_amount
                FROM request r
                LEFT JOIN request_quote q on q.request_id=r.request_id
                JOIN usr u ON
                    u.user_no=r.requester_id
                JOIN organisation o ON
                    o.org_code=u.org_code
                LEFT JOIN lookup_code c ON
                    c.source_table='request' AND
                    c.source_field='status_code' AND
                    c.lookup_code=r.last_status
                LEFT JOIN request_timesheet t ON
                    t.request_id=r.request_id AND
                    t.work_units='hours'
                WHERE
                    r.last_status NOT IN ('C') AND
                    r.request_id IN (
                        SELECT request_id
                        FROM request_tag
                        WHERE
                            tag_id IN (
                                SELECT tag_id
                                FROM organisation_tag
                                WHERE tag_description='Additional'
                            )
                    )
                GROUP BY r.request_id,r.brief,o.org_name,o.org_code,c.lookup_desc,q.quote_units,quote_amount`.replace(/\s+/, ' ');
    },
    function(data, ctx, next){
        let r = [],
            all_orgs = org_data.get_all_orgs();
        if (data && data.rows && data.rows.length > 0){
            r = data.rows.filter(row => {
                // Include orgs we're interested in, but only when there's no quote
                return all_orgs.indexOf(row.org_id) > -1 && !row.quote_amount;
            });
        }
        next(r);
    }
)
