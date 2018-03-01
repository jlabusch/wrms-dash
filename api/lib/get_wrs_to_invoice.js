var query = require('./query'),
    util = require('./util');

module.exports = query.prepare(
    'wrs_to_invoice',
    'wrs_to_invoice',
    function(ctx){
        return `SELECT q.request_id,
                       r.brief,
                       o.org_name AS org,
                       o.org_code AS org_id,
                       c.lookup_desc AS status,
                       q.quote_id,
                       q.quote_brief,
                       q.quote_amount
                FROM request_quote q
                JOIN request r ON q.request_id=r.request_id
                JOIN org_system s ON
                    s.system_id=r.system_id
                JOIN organisation o ON
                    o.org_code=s.org_code
                LEFT JOIN lookup_code c ON
                    c.source_table='request' AND
                    c.source_field='status_code' AND
                    c.lookup_code=r.last_status
                WHERE
                    q.quote_cancelled_by IS NULL AND
                    q.approved_by_id IS NOT NULL AND
                    q.invoice_no IS NULL AND
                    q.request_id IN (
                        SELECT request_id
                        FROM request_tag
                        WHERE
                            tag_id IN (
                                SELECT tag_id
                                FROM organisation_tag
                                WHERE tag_description='Additional'
                            )
                    )`.replace(/\s+/, ' ');
    },
    function(data, ctx, next){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            r = data.rows;
        }
        next(r);
    }
)
