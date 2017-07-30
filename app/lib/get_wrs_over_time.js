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

module.exports = query.prepare(
    'wrs_over_time',
    'wrs_over_time-debug',
    function(ctx){
        return `
            SELECT  r.request_id,
                    to_char(r.request_on, 'YYYY-MM') as created_on,
                    ra.note,
                    to_char(ra.date, 'YYYY-MM') as updated_on,
                    urg.lookup_desc as urgency
            FROM request r
            JOIN request_activity ra ON r.request_id=ra.request_id
            JOIN lookup_code urg on urg.source_table='request'
               AND urg.source_field='urgency'
               AND urg.lookup_code=cast(r.urgency as text)
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
                open_wrs = {
                    // request_id: severity
                };

            data.rows.forEach(row => {
                if (row.updated_on !== month){
                    r.push(fill_row(month, open_wrs));
                    month = row.updated_on;
                }

                if (closed.indexOf(row.note) < 0){
                    open_wrs[row.request_id] = util.map_severity(row.urgency);
                }else{
                    delete open_wrs[row.request_id];
                }
            });

            r.push(fill_row(month, open_wrs));
        }
        if (r.length > 12){
            r.splice(0, r.length-12);
        }
        r.unshift(['Month', 'Low', 'Medium', 'High', 'Critical']);
        next(r);
    }
)
