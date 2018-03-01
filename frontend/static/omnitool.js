var sev_colors = [
    default_colors[7],
    default_colors[0],
    default_colors[2],
    default_colors[10]
];

function handle_empty_data(chart, data){
    if (data.result.length < 1 ||
        data.result.length === 1 && data.result[0].wr === 'None')
    {
        chart.type('message')
            .message('No data');
        data.__skip_render = true;
    }
}

google.charts.load('current', {packages: ['corechart', 'bar', 'table', 'line']});
google.charts.setOnLoadCallback(draw_custom_charts);

function draw_custom_charts(){
    query('/wrs_to_invoice', function(err, data){
        if (err){
            console.log('wrs_to_invoice: ' + err);
            return;
        }
        console.log(JSON.stringify(data, null, 2));
        if (!data || !data || data.length < 1 || !data[0].request_id){
            (new Keen.Dataviz())
                .el('#chart-01')
                .type('message')
                .message('No quotes to invoice');
            return;
        }
        var table = new google.visualization.DataTable();
        table.addColumn('string', 'Client');
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('string', 'Status');
        table.addColumn('string', 'Quote');
        table.addColumn('number', 'Hours');
        table.addRows(
            data.map(function(row){
                return [
                    '<a href="/dashboard/' + row.org_id + '/" target="_blank">' + row.org + '</a>',
                    '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '" target="_blank">' + row.request_id + '</a>',
                    row.brief,
                    row.status,
                    row.quote_brief,
                    row.quote_amount
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-01'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    }, undefined, 0);
} // google charts

