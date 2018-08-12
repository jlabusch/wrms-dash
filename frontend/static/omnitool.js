function get_wrs_to_invoice(){
    query('/wrs_to_invoice', function(err, data){
        if (err){
            console.log('wrs_to_invoice: ' + err);
            return;
        }
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
        table.addColumn('number', 'Amount');
        table.addColumn('string', 'Units');
        table.addRows(
            data.map(function(row){
                return [
                    '<a href="/dashboard/' + row.org_id + '/" target="_blank">' + row.org + '</a>',
                    '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '" target="_blank">' + row.request_id + '</a>',
                    row.brief,
                    row.status,
                    row.quote_brief,
                    row.quote_amount,
                    row.quote_units
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-01'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    }, undefined, 0);
}

function get_additional_wrs_unquoted(){
    query('/additional_wrs_unquoted', function(err, data){
        if (err){
            console.log('additional_wrs_unquoted: ' + err);
            return;
        }
        if (!data || !data || data.length < 1 || !data[0].request_id){
            (new Keen.Dataviz())
                .el('#chart-03')
                .type('message')
                .message('No WRs to show');
            return;
        }
        var table = new google.visualization.DataTable();
        table.addColumn('string', 'Client');
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('string', 'Status');
        table.addColumn('number', 'Hours');
        table.addRows(
            data.map(function(row){
                return [
                    '<a href="/dashboard/' + row.org_id + '/" target="_blank">' + row.org + '</a>',
                    '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '" target="_blank">' + row.request_id + '</a>',
                    row.brief,
                    row.status,
                    row.worked
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-03'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    }, undefined, 0);
}

function get_new_sysadmin_wrs(){
    query('/new_sysadmin_wrs', function(err, data){
        if (err){
            console.log('new_sysadmin_wrs: ' + err);
            return;
        }
        if (!data || !data || data.length < 1 || !data[0].request_id){
            (new Keen.Dataviz())
                .el('#chart-02')
                .type('message')
                .message('No WRs to show');
            return;
        }
        var table = new google.visualization.DataTable();
        table.addColumn('string', 'Client');
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('number', 'Days old');
        table.addColumn('number', 'Updates');
        table.addRows(
            data.map(function(row){
                return [
                    '<a href="/dashboard/' + row.org_id + '/" target="_blank">' + row.org + '</a>',
                    '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '" target="_blank">' + row.request_id + '</a>',
                    row.brief,
                    row.age,
                    row.activity|0
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-02'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    }, undefined, 0);
}

function get_mis_report(){
    query('/mis_report', function(err, mis){
        if (err){
            console.log('mis_report: ' + err);
            return;
        }
        console.log(JSON.stringify(mis, null, 2));
        var o = JSON.parse(JSON.stringify(std_gchart_options));
        o.chartArea.height = 150;

        if (!mis || !mis.result || mis.result.length < 12){
            (new Keen.Dataviz())
                .el('#chart-05')
                .type('message')
                .message('No data');
            return;
        }

        mis.result.unshift(['Month', 'Sales']);

        var chart05 = new google.visualization.AreaChart(document.getElementById('chart-05'));

        var opt = {
            colors: [default_colors[7]],
            legend: {
                position: 'none'
            }
        };

        chart05.draw(google.visualization.arrayToDataTable(mis.result), opt);
    }, undefined, 0);
}

function draw_custom_charts(){
    get_wrs_to_invoice();
    get_additional_wrs_unquoted();
    get_new_sysadmin_wrs();
    get_mis_report();
}

google.charts.load('current', {packages: ['corechart', 'bar', 'table', 'line']});
google.charts.setOnLoadCallback(draw_custom_charts);

