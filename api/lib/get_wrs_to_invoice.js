var query = require('wrms-dash-db').query,
    qf = require('./quote_funcs'),
    util = require('wrms-dash-util');

module.exports = query.prepare(
    'wrs_to_invoice',
    'wrs_to_invoice',
    function(ctx){
        return `SELECT q.request_id,
                       r.brief,
                       r.invoice_to,
                       o.org_name AS org,
                       o.org_code AS org_id,
                       c.lookup_desc AS status,
                       (
                           SELECT string_agg(otag.tag_description, ',')
                           FROM organisation_tag otag
                           JOIN request_tag rtag ON rtag.tag_id=otag.tag_id
                           WHERE rtag.request_id=r.request_id
                       ) as tags,
                       q.quote_id,
                       q.quote_brief,
                       CASE WHEN q.quote_units = 'days' THEN q.quote_amount*8
                            ELSE q.quote_amount
                       END AS quote_amount,
                       CASE WHEN q.quote_units = 'days' THEN 'hours'
                            ELSE q.quote_units
                       END AS quote_units
                FROM request_quote q
                JOIN request r ON q.request_id=r.request_id
                JOIN usr u ON
                    u.user_no=r.requester_id
                JOIN organisation o ON
                    o.org_code=u.org_code
                LEFT JOIN lookup_code c ON
                    c.source_table='request' AND
                    c.source_field='status_code' AND
                    c.lookup_code=r.last_status
                WHERE
                    q.quote_cancelled_by IS NULL AND
                    q.approved_by_id IS NOT NULL AND
                    q.invoice_no IS NULL AND
                    o.org_code IN ( ${util.org_data.active().get_all_orgs().join(',')})`.replace(/\s+/, ' ');
    },
    function(data, ctx, next){
        let err = util.send_err_if_not_vendor(null, null, null, ctx, __filename);
        if (err){
            next(err);
            return;
        }

        let r = [];
        if (data && data.rows && data.rows.length > 0){
            r = data.rows.filter(row => {
                return qf.describe_quote(row).additional;
            });
        }
        next(r);
    }
)
