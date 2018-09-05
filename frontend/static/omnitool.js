function period_date_sort(a, b){
    var am = a.month.match(/(\d\d\d\d).(\d?\d)/),
        bm = b.month.match(/(\d\d\d\d).(\d?\d)/);

    var ami = parseInt(am[1])*100 + parseInt(am[2]),
        bmi = parseInt(bm[1])*100 + parseInt(bm[2]);

    return ami - bmi;
}

function make_budget_vs_actual_chart(chart, header, data, mapper){
    var table = data.periods.sort(period_date_sort).map(mapper);

    table.unshift(header);

    var c = new google.visualization.AreaChart(document.getElementById(chart));

    var o = JSON.parse(JSON.stringify(std_gchart_options));
    o.chartArea.width = '80%';
    o.legend = {position: 'right'};
    o.colors = default_colors;

    c.draw(google.visualization.arrayToDataTable(table), o);
}

function make_metric(el, title){
    return new Keen.Dataviz()
        .el(el)
        .title(title)
        .height(250)
        .colors([default_colors[0]])
        .type('metric')
        .prepare();
}

var chart08 = make_metric('#chart-08', 'Visible FTE'),
    chart09 = make_metric('#chart-10', 'Additional FTE'),
    chart10 = make_metric('#chart-09', 'Internal FTE');

function get_fte_budgets(){
    query('/fte_budgets', function(err, fte_data){
        if (err){
            console.log('fte_budgets: ' + err);
            return;
        }

        //console.log(fte_data);

        if (!fte_data || !fte_data.periods || fte_data.periods.length < 1){
            ['06', '07', '08', '09', '10', '11', '12'].forEach(function(x){
                (new Keen.Dataviz())
                    .el('#chart-'+x)
                    .type('message')
                    .message('Budgets not available');
            });
            return;
        }

        make_budget_vs_actual_chart('chart-06', ['Month', 'Budget', 'Actual'], fte_data, function(p){ return [p.month, p.sla_budget.total, p.sla_hours.total]; });
        make_budget_vs_actual_chart('chart-07', ['Month', 'Budget', 'Actual'], fte_data, function(p){ return [p.month, p.additional_budget.total, p.additional_hours.total]; });
        make_budget_vs_actual_chart('chart-11', ['Month', 'Budget', 'Actual'], fte_data, function(p){ return [p.month, p.sla_fee_hours.total, p.sla_hours.total + p.unchargeable_hours.total]; });

        var metrics = {
            visible:    { max: 0, total: 0 },
            additional: { max: 0, total: 0 },
            internal:   { max: 0, total: 0 }
        };
        function count_metric(name, val){
            metrics[name].max = Math.max(val, metrics[name].max);
            metrics[name].total += val;
        }
        fte_data.periods.forEach(function(p){
            count_metric('visible', p.sla_hours.total);
            count_metric('additional', p.additional_hours.total);
            count_metric('internal', p.sla_hours.total + p.unchargeable_hours.total);
        });
        function to_fte(n, periods){
            var avg_business_days = 21.167;
            var work_per_day = 8;
            periods = periods || fte_data.periods.length;
            return n / periods / avg_business_days / work_per_day;
        }
        function round(n){
            return Math.round(n*10)/10;
        }
        chart08.title('Max ' + round(to_fte(metrics.visible.max, 1)));
        render(chart08)(null, {result: to_fte(metrics.visible.total) });

        chart10.title('Max ' + round(to_fte(metrics.additional.max, 1)));
        render(chart10)(null, {result: to_fte(metrics.additional.total) });

        chart09.title('Max ' + round(to_fte(metrics.internal.max, 1)));
        render(chart09)(null, {result: to_fte(metrics.internal.total) });

        query('/raw_timesheets', function(err, ts_data){
            if (err){
                console.log('raw_timesheets: ' + err);
                return;
            }

            //console.log('Timesheets:');
            //console.log(ts_data);

            var now = new Date();

            if (!ts_data || !ts_data[now.getFullYear() + '-1']){
                (new Keen.Dataviz())
                    .el('#chart-12')
                    .type('message')
                    .message('No data');
                return;
            }

            query('/mis_report', function(err, mis_data){
                if (err){
                    console.log('mis_report: ' + err);
                    return;
                }

                //console.log('MIS data:');
                //console.log(mis_data);

                if (!mis_data || !mis_data[now.getFullYear() + '-1']){
                    (new Keen.Dataviz())
                        .el('#chart-12')
                        .type('message')
                        .message('No data');
                    return;
                }

                var table = [
                    ['Month', 'Invoices', 'SLA fees', 'Client hours']
                ];

                var std_GBP_rate = 85;

                fte_data.periods.sort(period_date_sort).map(function(fte_row){
                    var ts_row = ts_data[fte_row.month],
                        mis_row = mis_data[fte_row.month];

                    table.push([
                        fte_row.month,
                        mis_row ? mis_row.sales/std_GBP_rate : 0,
                        fte_row.sla_fee_hours.total,
                        ts_row ? ts_row.total : 0 // maybe nobody has timesheeted to the current month yet
                    ]);
                });

                //console.log(table);

                var chart12 = new google.visualization.AreaChart(document.getElementById('chart-12'));

                var o = JSON.parse(JSON.stringify(std_gchart_options));
                o.chartArea.width = '80%';
                o.legend = {position: 'right'};
                o.colors = default_colors;

                chart12.draw(google.visualization.arrayToDataTable(table), o);
            }, undefined, 0);
        }, undefined, 0);
    }, undefined, 0);
}

function get_wrs_to_invoice(){
    query('/wrs_to_invoice', function(err, data){
        if (err){
            console.log('wrs_to_invoice: ' + err);
            return;
        }
        if (!data || data.length < 1 || !data[0] || !data[0].request_id){
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
        if (!data || data.length < 1 || !data[0] || !data[0].request_id){
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
        if (!data || data.length < 1 || !data[0] || !data[0].request_id){
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

function draw_custom_charts(){
    get_fte_budgets();
    get_wrs_to_invoice();
    get_additional_wrs_unquoted();
    get_new_sysadmin_wrs();
}

google.charts.load('current', {packages: ['corechart', 'bar', 'table', 'line']});
google.charts.setOnLoadCallback(draw_custom_charts);

