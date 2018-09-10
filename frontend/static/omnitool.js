var cached_fte_data = undefined,
    cached_timesheet_data = undefined,
    cached_mis_data = undefined,
    cached_invoice_data = undefined;

function round(n){
    return Math.round(n*10)/10;
}

function period_date_sort(a, b){
    var am = a.month.match(/(\d\d\d\d).(\d?\d)/),
        bm = b.month.match(/(\d\d\d\d).(\d?\d)/);

    var ami = parseInt(am[1])*100 + parseInt(am[2]),
        bmi = parseInt(bm[1])*100 + parseInt(bm[2]);

    return ami - bmi;
}

function make_budget_vs_actual_chart(chart, header, data, mapper, contract){
    var table = data.periods.sort(period_date_sort).map(mapper);

    table.unshift(header);

    var c = new google.visualization.AreaChart(document.getElementById(chart));

    var o = JSON.parse(JSON.stringify(std_gchart_options));
    o.chartArea.width = '75%';
    o.legend = {position: 'right'};
    o.colors = default_colors;

    var title = document.getElementById(chart + '-title');
    title.innerText = title.innerText.replace(/\([^)]*\)$/, '(' + contract + ')');

    c.draw(google.visualization.arrayToDataTable(table), o);
}

function make_metric(el){
    return new Keen.Dataviz()
        .el(el)
        .height(150)
        .colors([default_colors[0]])
        .type('metric')
        .prepare();
}

var chart08 = make_metric('#chart-08'),
    chart09 = make_metric('#chart-09'),
    chart10 = make_metric('#chart-10'),
    chart15 = make_metric('#chart-15').height(250);

function filter_by_month(){
    render_invoices(this.value);
}

// Contract defaults to "total", i.e. all of them.
function filter_by_contract(){
    render_fte_budgets(this.value === 'All contracts' ? null : this.value);
}

function to_fte(n, periods){
    var avg_business_days = 21.167;
    var work_per_day = 8;
    periods = periods || cached_fte_data.periods.length;
    return n / periods / avg_business_days / work_per_day;
}

function render_fte_budgets(contract_to_render){
    contract_to_render = contract_to_render || 'total';

    make_budget_vs_actual_chart(
        'chart-06',
        ['Month', 'Budget', 'Actual', 'Committed'],
        cached_fte_data,
        function(p){
            return [p.month, p.sla_budget[contract_to_render] || 0, p.sla_hours[contract_to_render] || 0, p.sla_hours_committed[contract_to_render] || 0];
        },
        contract_to_render
    );
    make_budget_vs_actual_chart(
        'chart-07',
        ['Month', 'Budget', 'Actual'],
        cached_fte_data,
        function(p){
            return [p.month, p.additional_budget[contract_to_render] || 0, p.additional_hours[contract_to_render] || 0];
        },
        contract_to_render
    );
    make_budget_vs_actual_chart(
        'chart-11',
        ['Month', 'Budget', 'Actual'],
        cached_fte_data,
        function(p){
            return [p.month, p.sla_fee_hours[contract_to_render] || 0, (p.sla_hours[contract_to_render] || 0) + (p.unchargeable_hours[contract_to_render] || 0)];
        },
        contract_to_render
    );

    var metrics = {
        visible:    { max: 0, total: 0 },
        additional: { max: 0, total: 0 },
        internal:   { max: 0, total: 0 }
    };
    function count_metric(name, val){
        metrics[name].max = Math.max(val, metrics[name].max);
        metrics[name].total += val;
    }
    cached_fte_data.periods.forEach(function(p){
        var sla_hours = p.sla_hours[contract_to_render] || 0,
            add_hours = p.additional_hours[contract_to_render] || 0,
            free_hours = p.unchargeable_hours[contract_to_render] || 0;
        count_metric('visible', sla_hours);
        count_metric('additional', add_hours);
        count_metric('internal', sla_hours+free_hours);
    });
    chart08.title('Avg FTE (max ' + round(to_fte(metrics.visible.max, 1)) + ')');
    render(chart08)(null, {result: to_fte(metrics.visible.total) });

    chart10.title('Avg FTE (max ' + round(to_fte(metrics.additional.max, 1)) + ')');
    render(chart10)(null, {result: to_fte(metrics.additional.total) });

    chart09.title('Avg FTE (max ' + round(to_fte(metrics.internal.max, 1)) + ')');
    render(chart09)(null, {result: to_fte(metrics.internal.total) });
}

var chart13 = new Keen.Dataviz()
    .el('#chart-13')
    .colors(default_colors)
    .height(350)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

var chart14 = new Keen.Dataviz()
    .el('#chart-14')
    .colors(default_colors)
    .height(350)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

function get_invoices(){
    query('/invoices', function(err, inv_data){
        if (err){
            console.log('invoices: ' + err);
            render(chart14, [])(err);
            return;
        }

        cached_invoice_data = inv_data;

        var months = [];
        if (inv_data){
            months = Object.values(inv_data);
        }

        // In future we may allow month selection.
        var chosen = undefined,
            month_select = document.getElementById('month-select');

        month_select.onchange = filter_by_month;

        months.sort(period_date_sort).reverse().forEach(function(m){
            month_select.add(new Option(m.month));
            if (!chosen){
                chosen = m.month;
            }
        });

        render_invoices(chosen);
    }, undefined, 0);
}

function render_invoices(month){
    $('#invoicing_section_title').each(function(i, e){ e.innerText = e.innerText.replace(/PERIOD/g, month); });

    var threshold = 70;

    if (cached_timesheet_data && cached_timesheet_data[month]){
        var ts_orgs = Object.keys(cached_timesheet_data[month]).filter(function(k){ return k !== 'total' && k !== 'month' }).sort(),
            ts_other = 0,
            ts_result = {
                result: []
            };

        ts_orgs.forEach(function(o){
            var v = cached_timesheet_data[month][o];
            if (v < threshold){
                ts_other += v;
            }else{
                ts_result.result.push({Client: o, result: round(v)});
            }
        });

        if (ts_other > 0){
            ts_result.result.push({Client: "Other", result: round(ts_other)});
        }

        render(chart13)(null, ts_result);
    }

    if (cached_invoice_data && cached_invoice_data[month] && cached_invoice_data[month].clients){
        var inv_orgs = Object.keys(cached_invoice_data[month].clients).sort(),
            inv_other = 0,
            inv_result = {
                result: []
            };

        inv_orgs.forEach(function(o){
            var c = cached_invoice_data[month].clients[o];
            if (c.hours_equiv < threshold){
                inv_other += c.hours_equiv;
            }else{
                inv_result.result.push({Client: c.name, result: round(c.hours_equiv)});
            }
        });

        if (inv_other > 0){
            inv_result.result.push({Client: "Other", result: round(inv_other)});
        }

        render(chart14)(null, inv_result);
    }
}

function render_mis_vs_timesheets(){
    var table = [
        ['Month', 'Invoices', 'Client hours', 'SLA fees']
    ];

    var std_GBP_rate = 85,
        max_fte = 0,
        total_fte = 0;

    cached_fte_data.periods.sort(period_date_sort).map(function(fte_row){
        var ts_row = cached_timesheet_data[fte_row.month],
            ts = ts_row ? ts_row.total : 0, // maybe nobody has timesheeted to the current month yet
            mis_row = cached_mis_data[fte_row.month];

        max_fte = Math.max(max_fte, ts);
        total_fte += ts;

        table.push([
            fte_row.month,
            mis_row ? mis_row.sales/std_GBP_rate : 0,
            ts,
            fte_row.sla_fee_hours.total
        ]);
    });

    var chart12 = new google.visualization.AreaChart(document.getElementById('chart-12'));

    var o = JSON.parse(JSON.stringify(std_gchart_options));
    o.chartArea.width = '80%';
    o.legend = {position: 'right'};
    o.colors = default_colors;

    chart12.draw(google.visualization.arrayToDataTable(table), o);

    chart15.title('Avg FTE (max ' + round(to_fte(max_fte, 1)) + ')');
    render(chart15)(null, {result: to_fte(total_fte) });
}

function get_mis_report(){
    query('/mis_report', function(err, mis_data){
        if (err){
            console.log('mis_report: ' + err);
            return;
        }

        var now = new Date();

        if (!mis_data || !mis_data[now.getFullYear() + '-1']){
            (new Keen.Dataviz())
                .el('#chart-12')
                .type('message')
                .message('No data');
            render(chart13)({message: 'No data available'});
            return;
        }

        cached_mis_data = mis_data;

        render_mis_vs_timesheets();
    }, undefined, 0);
}

function get_raw_timesheets(){
    query('/raw_timesheets', function(err, ts_data){
        if (err){
            console.log('raw_timesheets: ' + err);
            render(chart13)(err);
            return;
        }

        var now = new Date();

        if (!ts_data || !ts_data[now.getFullYear() + '-1']){
            (new Keen.Dataviz())
                .el('#chart-12')
                .type('message')
                .message('No data');
            return;
        }

        cached_timesheet_data = ts_data;

        get_invoices();
        get_mis_report();
    }, undefined, 0);
}

function get_fte_budgets(){
    query('/fte_budgets', function(err, fte_data){
        if (err){
            console.log('fte_budgets: ' + err);
            return;
        }

        if (!fte_data || !fte_data.periods || fte_data.periods.length < 1){
            ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15'].forEach(function(x){
                (new Keen.Dataviz())
                    .el('#chart-'+x)
                    .type('message')
                    .message('No data available');
            });
            return;
        }

        if (Array.isArray(fte_data.contracts)){
            var select = document.getElementById('client-select');
            select.onchange = filter_by_contract;
            fte_data.contracts.sort().forEach(function(c){
                select.add(new Option(c));
            });
        }

        cached_fte_data = fte_data;

        render_fte_budgets(null);

        get_raw_timesheets();
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

// Currently unused.
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
}

google.charts.load('current', {packages: ['corechart', 'bar', 'table', 'line']});
google.charts.setOnLoadCallback(draw_custom_charts);

