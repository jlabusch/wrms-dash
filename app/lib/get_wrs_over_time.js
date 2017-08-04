var query = require('./query'),
    util = require('./util');

/*
     A | Quote Approved
     B | Need Info
     C | Cancelled
     D | Needs Documenting
     E | Development Complete
     F | Finished
     G | Request for Quote
     H | On Hold
     I | In Progress
     J | For Sign Off
     K | Provide Feedback
     L | Allocated
     M | Parked
     N | New request
     O | Ongoing Maintenance
     P | Production Ready
     Q | Quoted
     R | Reviewed
     S | Ready for Staging
     T | Testing/Signoff
     U | Catalyst Testing
     V | QA Approved
     W | Pending QA
     X | Blocked
     Z | Failed Testing
*/
var closed = [ 'C', 'F', 'O', 'M', 'X', 'H'];

function new_row(m){
    return [m, 0, 0, 0, 0];
}

function fill_row(m, sev_by_wr){
    let nr = new_row(m),
        list = Object.keys(sev_by_wr);
    list.forEach(wr => {
        nr[ sev_by_wr[wr].number+1 ]++;
    });
    // console.log('get_wrs_over_time: at the end of ' + m + ' these ' + list.length + ' WRs were open: ' + JSON.stringify(list));
    return nr;
}

function find_gaps(from, to){
    let gaps = [],
        fp = util.parse_period(from),
        tp = util.parse_period(to);

    if (!fp || !tp){
        console.log("wrs_over_time: can't parse periods");
        return gaps;
    }

    if (tp.period === fp.period){
        return gaps;
    }

    let p = util.next_period_obj(fp);

    while (p.period !== tp.period){
        gaps.push(p.period);
        p = util.next_period_obj(p);
    }
    return gaps;
}

module.exports = query.prepare(
    'wrs_over_time',
    'wrs_over_time',
    function(ctx){
        return `
            SELECT  r.request_id,
                    to_char(r.request_on, 'YYYY-MM') as created_on,
                    ra.note,
                    to_char(ra.date, 'YYYY-MM') as updated_on,
                    urg.lookup_desc as urgency,
                    imp.lookup_desc as importance
            FROM request r
            JOIN request_activity ra ON r.request_id=ra.request_id
            JOIN lookup_code urg on urg.source_table='request'
               AND urg.source_field='urgency'
               AND urg.lookup_code=cast(r.urgency as text)
            JOIN lookup_code imp on imp.source_table='request'
               AND imp.source_field='importance'
               AND imp.lookup_code=cast(r.importance as text)
            WHERE ra.org_code=${ctx.org}
              AND ra.system_id IN (${ctx.sys.join(',')})
              AND ra.source='status'
            ORDER BY ra.date ASC
        `;
    },
    function(data, ctx, next){
        let r = [];
        if (data && data.rows && data.rows.length > 0){

            let month = data.rows[0].updated_on,
                seen_ctx_period = false,
                open_wrs = {
                    // request_id: severity
                };

            data.rows.forEach(row => {
                if (row.updated_on !== month){
                    if (seen_ctx_period){
                        // We're up to date, do no more
                        return;
                    }
                    r.push(fill_row(month, open_wrs));
                    seen_ctx_period = seen_ctx_period || (ctx.period === util.parse_period(row.updated_on).period);

                    find_gaps(month, row.updated_on).forEach(gap => {
                        if (seen_ctx_period){
                            return;
                        }
                        r.push(fill_row(gap, open_wrs));
                        seen_ctx_period = (ctx.period === gap);
                    });

                    month = row.updated_on;
                }

                if (closed.indexOf(row.note) < 0){
                    open_wrs[row.request_id] = util.map_severity(row.urgency, row.importance);
                }else{
                    delete open_wrs[row.request_id];
                }
            });

            if (!seen_ctx_period || ctx.period === util.parse_period(month).period){
                r.push(fill_row(month, open_wrs));
            }
        }
        if (r.length > 12){
            r.splice(0, r.length-12);
        }
        r.unshift(['Month', 'Low', 'Medium', 'High', 'Critical']);
        next(r);
    }
)
