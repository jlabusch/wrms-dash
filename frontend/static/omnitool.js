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

var std_gchart_options = {
    titlePosition: 'none',
    legend: {position: 'none'},
    chartArea: {height: 200, left: '10%', width: '90%' },
    height: 250,
    orientation: 'horizontal',
    annotations: {
        alwaysOutside: true,
        textStyle: {
            fontSize: 12,
            auraColor: 'none',
            color: '#555'
        },
        boxStyle: {
            stroke: '#ccc',
            strokeWidth: 1,
            gradient: {
                color1: '#f3e5f5',
                color2: '#f3e5f5',
                x1: '0%', y1: '0%',
                x2: '100%', y2: '100%'
            }
        }
    },
    hAxis: {
        title: 'Category'
    },
    vAxis: {
        title: 'Number of WRs',
        minValue: 0
    },
    axisTitlesPosition: 'none'
};

google.charts.load('current', {packages: ['corechart', 'bar', 'table', 'line']});
google.charts.setOnLoadCallback(draw_custom_charts);

function draw_custom_charts(){
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

    query('/budget_summary', function(err, budgets){
        if (err){
            console.log('budget_summary: ' + err);
            return;
        }
        console.log(JSON.stringify(budgets, null, 2));
        var o = JSON.parse(JSON.stringify(std_gchart_options));
        o.chartArea.height = 150;

        var data = Object.keys(budgets).map(function(name){
            var used_sla_hours = budgets[name].result.reduce(sum_sla_hours, 0),
                color = default_colors[1];

            if (used_sla_hours < budgets[name].budget * 0.75) {
                color = default_colors[7];
            } else if (used_sla_hours < budgets[name].budget) {
                color = default_colors[2];
            }

            return [name, budgets[name].budget - used_sla_hours, color];
        });

        if (data.length < 1){
            (new Keen.Dataviz())
                .el('#chart-04')
                .type('message')
                .message('No data');
            return;
        }

        data.unshift(['Client', 'Hours left', {role: 'style'}]);

        var chart04 = new google.visualization.BarChart(document.getElementById('chart-04'));

        chart04.draw(google.visualization.arrayToDataTable(data), o);
    }, undefined, 0);

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
} // google charts

