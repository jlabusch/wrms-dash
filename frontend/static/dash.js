var sev_colors = [
    default_colors[7],
    default_colors[0],
    default_colors[2],
    default_colors[10]
];

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

function toggle_faqs(){
    set_faqs(!window.localStorage.getItem('dashboard-faq-hidden'));
}

function set_faqs(hidden){
    var d;
    if (hidden){
        d = 'none';
        window.localStorage.setItem('dashboard-faq-hidden', true);
    }else{
        d = 'block';
        window.localStorage.removeItem('dashboard-faq-hidden');
    }

    document.querySelectorAll('.faq').forEach(function(el){
        el.style.display = d;
    });
}

(function(){
    set_faqs(window.localStorage.getItem('dashboard-faq-hidden') || window.location.search.match(/nohelp/));

    $('div.chart-title').each(function(i, e){ e.innerText = e.innerText.replace(/PERIOD/g, PERIOD); });
    $('div.chart-notes').each(function(i, e){ e.innerText = e.innerText.replace(/PERIOD/g, PERIOD); });
    $('#period-current').html(PERIOD);
})();

var chart06 = new Keen.Dataviz()
    .el('#chart-06')
    .title('WRs')
    .height(250)
    .colors([default_colors[0]])
    .type('metric')
    .prepare();

query('/wrs_created_count', render(chart06));

var chart15 = new Keen.Dataviz()
    .el('#chart-15')
    .title('Hours')
    .height(250)
    .colors([default_colors[0]])
    .type('metric')
    .prepare();

function format_icinga_note(obj){
    if (obj.service.indexOf(obj.host) > -1){
        return obj.service;
    }else{
        return obj.host + '/' + obj.service;
    }
}

var chart07 = new Keen.Dataviz()
    .el('#chart-07')
    .title('uptime')
    .height(250)
    .chartOptions({suffix: '%'})
    .type('metric')
    .prepare();

// See the /availability query in draw_custom_charts() for chart07 rendering...

var chart09 = new Keen.Dataviz()
    .el('#chart-09')
    .title('used')
    .height(250)
    .chartOptions({suffix: 'MB'})
    .type('metric')
    .prepare();

var chart10 = new Keen.Dataviz()
    .el('#chart-10')
    .colors([default_colors[9]])
    .height(250)
    .type('metric')
    .prepare();

// TODO: for clients with user limits defined by contract, e.g. Totara, make this a guage chart instead.
query('/users', render(chart10, function(chart, data){
    if (data.error || !data.result){
        chart10
            .type('message')
            .message('No data');
        data.__skip_render = true;
        console.log('users: ' + data.error);
        return;
    }
    data.result = data.result.result;
    chart10
        .type('metric')
        .title('user accounts');
}));

query('/customer', function(err, data){
    if (!err){
        $('#cust-name').text(data.system.name);
        $('#cust-system').attr('href', 'https://wrms.catalyst.net.nz/kanban/?systems=' + data.system.id + '&hide_done=true&wr_edit_mode=false&board_title=' + encodeURIComponent(data.system.name));
        $('#period-current').attr('href', 'https://wrms.catalyst.net.nz/requestlist.php?org_code=' + data.org.id);
    }
});

var donut_options = {
    donut: {
        label: {
            format: function(value, ratio, id){ return value + ' hours'; }
        }
    },
    chartArea: {
        height: "85%",
        left: "5%",
        top: "5%",
        width: "100%"
    }
}

function handle_empty_data(chart, data){
    if (data.result.length < 1 ||
        data.result.length === 1 && data.result[0].wr === 'None')
    {
        chart.type('message')
            .message('No data');
        data.__skip_render = true;
    }
}

function set_total(selector){
    return function(chart, data){
        if (data){
            let n = 0;
            if (data.result && Array.isArray(data.result)){
                n = data.result.reduce((acc, val) => {
                    return acc + (Array.isArray(val) ? val[0].result : val.result);
                }, 0);
            }else{
                n = data.result;
            }
            if (n){
                $(selector).text('Total: ' + n + ' hours');
            }
        }
    }
}

var chart02 = new Keen.Dataviz()
    .el('#chart-02')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

query('/sla_quotes', render(chart02, [set_total('#chart-02-notes'), handle_empty_data]));

var chart14 = new Keen.Dataviz()
    .el('#chart-14')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

query('/sla_unquoted', render(chart14, [set_total('#chart-14-notes'), handle_empty_data]));

var chart03 = new Keen.Dataviz()
    .el('#chart-03')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

query('/additional_quotes', render(chart03, [set_total('#chart-03-notes'), handle_empty_data]));

google.charts.load('current', {packages: ['corechart', 'bar', 'table', 'line']});
google.charts.setOnLoadCallback(draw_custom_charts);

function draw_custom_charts(){
    query('/wrs_over_time', function(err, data){
        if (err){
            console.log('wrs_over_time: ' + err);
            return;
        }

        var o = JSON.parse(JSON.stringify(std_gchart_options));
        o.legend.position = 'right';
        o.curveType = 'function';
        o.colors = sev_colors;
        o.vAxis.viewWindow = {min:0};
        o.chartArea = {
            top: '5%', height: 200, left: '5%', width: '80%'
        };
        o.height = 250;

        var chart11 = new google.visualization.LineChart(document.getElementById('chart-11'));

        chart11.draw(google.visualization.arrayToDataTable(data), o);
    });

    query('/sla_hours', function(err, data){
        if (err){
            console.log('sla_hours: ' + err);
            return;
        }

        if (data.error){
            console.log('sla_hours: ' + data.error);
            return;
        }

        var o = JSON.parse(JSON.stringify(std_gchart_options));
        o.orientation = 'vertical';
        o.chartArea = {height: 200, left: '25%', width: '75%' };
        o.__a = o.hAxis;
        o.hAxis = o.vAxis;
        o.vAxis = o.__a;

        var used_sla_hours = data.result.reduce(sum_sla_hours, 0);

        document.getElementById('chart-15-notes').innerText = 'Used ' + used_sla_hours + ' of ' + data.budget + ' hours';

        // Target format is
        //  ['Category', 'Hours', {role: 'style'}],
        //  ['$column_heading', $value, $color],
        //  [...]
        data.result.forEach((row, i) => { row.push(default_colors[i]) });
        data.result.unshift(['Category', 'Hours', {role: 'style'}]);

        chart15.colors([default_colors[1]]);
        if (used_sla_hours < data.budget * 0.75) {
            chart15.colors([default_colors[7]]);
        } else if (used_sla_hours < data.budget) {
            chart15.colors([default_colors[2]]);
        }
        render(chart15)(null, {result: data.budget - used_sla_hours});
    });

    query('/severity', function(err, data){
        if (err){
            console.log('severity: ' + err);
            return;
        }
        data.forEach((row, i) => { row.push(sev_colors[i]) });
        data.unshift(['Category', 'Number of WRs', {role: 'style'}]);

        var chart04 = new google.visualization.BarChart(document.getElementById('chart-04'));

        chart04.draw(google.visualization.arrayToDataTable(data), std_gchart_options);
    });

    query('/response_times', function(err, data){
        if (err){
            console.log('response_times: ' + err);
            return;
        }
        if (data.result.length < 2){
            (new Keen.Dataviz())
                .el('#chart-08')
                .type('message')
                .message('No data');
            return;
        }
        data.result.forEach((row, i) => { row.push(sev_colors[i]) });
        data.result.unshift(['Category', '95% response time', {role: 'style'}]);

        var chart08 = new google.visualization.BarChart(document.getElementById('chart-08'));

        chart08.draw(google.visualization.arrayToDataTable(data.result), std_gchart_options);
    });

    query('/statuses', function(err, data){
        if (err){
            console.log('statuses: ' + err);
            return;
        }
        if (data.length < 1){
            console.log('statuses: no data');
            return;
        }
        var o = JSON.parse(JSON.stringify(std_gchart_options));
        o.chartArea.height = 150;

        data.forEach((row, i) => { row.push(default_colors[0]) });
        data.unshift(['Category', 'Number of WRs', {role: 'style'}]);

        var chart05 = new google.visualization.BarChart(document.getElementById('chart-05'));

        chart05.draw(google.visualization.arrayToDataTable(data), o);
    });

    query('/wr_list', function(err, data){
        if (err){
            console.log('wr_list: ' + err);
            return;
        }
        if (data.length < 1){
            (new Keen.Dataviz())
                .el('#chart-13')
                .type('message')
                .message('No data');
            return;
        }
        var table = new google.visualization.DataTable();
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('string', 'Status');
        table.addColumn('string', 'Urgency');
        table.addRows(
            data.map(function(row){
                return [
                    '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '">' + row.request_id + '</a>',
                    row.brief,
                    row.status,
                    row.urgency
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-13'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    });

    query('/pending_quotes', function(err, data){
        if (err){
            console.log('pending_quotes: ' + err);
            return;
        }
        if (!data || !data.result || data.result.length < 1 || !data.result[0].request_id){
            (new Keen.Dataviz())
                .el('#chart-01')
                .type('message')
                .message('No pending quotes');
            return;
        }
        var table = new google.visualization.DataTable();
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('number', 'Hours');
        var pending_total = 0;
        table.addRows(
            data.result.map(function(row){
                pending_total += row.quote_amount;
                return [
                    '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '">' + row.request_id + '</a>',
                    row.brief,
                    row.quote_amount
                ];
            })
        );
        document.getElementById('chart-01-notes').innerText = 'Total: ' + pending_total + ' hours';
        var viz = new google.visualization.Table(document.getElementById('chart-01'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    });


    query('/deployments', function(err, data){
        if (err){
            console.log('deployments: ' + err);
            return;
        }

        var formatted_data = data.map(function(row){
            var arr = row.description.split('\n');
            var desc = arr.filter(function(element){
                return element && element.match(/^\s*\*/);
            }).join('<br>');

            return [
                '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '">' + row.request_id + '</a>',
                row.brief,
                desc
            ];
        });

        if (formatted_data.length < 1){
            (new Keen.Dataviz())
                .el('#chart-12')
                .type('message')
                .height(250)
                .message('No deployments');
            return;
        }

        var table = new google.visualization.DataTable();
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('string', 'Description');
        table.addRows(formatted_data);

        var viz = new google.visualization.Table(document.getElementById('chart-12'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    });

    query('/availability', render(chart07, function(c, d){

        var metric_chart = false;

        if (d.error || !d.length){
            d.result = 0;
            console.log('availability: ' + d.error);
            metric_chart = true;
            setTimeout(function(){ $('#chart-07 .keen-dataviz-metric-value').text('N/A'); }, 10);
            return;
        }

        if (d.length === 1){
            $('#avail-notes').text(d[0][0]);
            d.result = d[0][1];
            metric_chart = true;
        }else{
            $('#avail-notes').text('Uptime percentage');
        }

        if (metric_chart){
            if (d.result < 99.5){
                c.colors([default_colors[1]]);
            }else if (d.result < 99.9){
                c.colors([default_colors[2]]);
            }else{
                c.colors([default_colors[7]]);
            }
        }else{
            d.__skip_render = true; // rendered here

            d.forEach(row => {
                var k = default_colors[7];

                if (row[1] < 99.5){
                    k = default_colors[1];
                }else if (row[1] < 99.9){
                    k = default_colors[2];
                }

                row.push(k)
            });

            d.unshift(['Service', 'Availability', {role: 'style'}]);

            $('#chart-07').empty();

            var o = JSON.parse(JSON.stringify(std_gchart_options));

            o.vAxis.minValue = 99; // If you have values less than 99, the chart automatically
                                   // extends the minimum so everything gets shown.

            (new google.visualization.BarChart(document.getElementById('chart-07')))
                .draw(google.visualization.arrayToDataTable(d), o);
        }
    }));

    query('/diskusage_moodle', render(chart09, function(c, d){

        var metric_chart = false;

        let length = Object.keys(d.result).length;

        if (d.error || !length){
            d.result = 0;
            console.log('diskusage_moodle: ' + c + d.result);
            metric_chart = true;
            setTimeout(function(){ $('#chart-09 .keen-dataviz-metric-value').text('N/A'); }, 10);
            return;
        }

        d.__skip_render = true; // Rendered here.

        d.result.forEach(row => {
            var k = default_colors[7];

            // TODO: Based on max disk size colour the chart.

            row.push(k);
        });

        d.result.unshift(['Service', 'Diskusage in MB', {role: 'style'}]);

        $('#chart-09').empty();

        var o = JSON.parse(JSON.stringify(std_gchart_options));

        o.vAxis.minValue = 99; // If you have values less than 99, the chart automatically
                               // extends the minimum so everything gets shown.

        (new google.visualization.BarChart(document.getElementById('chart-09')))
            .draw(google.visualization.arrayToDataTable(d.result), o);
    }));

} // Google charts.

var gophers = [
    '7TH_BIRTHDAY.png',
    'BATMAN_GOPHER.png',
    'BELGIUM.png',
    'Biker_Gopher.png',
    'BUFFALO_CASTS.png',
    'CouchPotatoGopher.png',
    'COWBOY_GOPHER.png',
    'DockerGopher.png',
    'DRAWING_GOPHER.png',
    'GIRL_GOPHER.png',
    'GO_BUFFALO.png',
    'GO_BUG.png',
    'GO_LEARN.png',
    'GO_PARIS.png',
    'GOPHER_ADADEMY.png',
    'GOPHERCON_ICELAND.png',
    'GOPHERCON.png',
    'GOPHER_DAD.png',
    'GOPHER_DENVER.png',
    'GOPHER_INCLUSION.png',
    'GOPHER_LAPTOP.png',
    'GOPHER_MIC_DROP_WITH_BACKGROUND.png',
    'GOPHER_PARAKEET.png',
    'GOPHER_ROCKS.png',
    'GOPHER_SAFARI.png',
    'GOPHER_SAILOR_STRIPE.png',
    'GopherSpaceCommunity.png',
    'GopherSpaceMentor.png',
    'HALLOWEEN_GOPHER.png',
    'LazyGopher.png',
    'LION_GOPHER.png',
    'MOTORCYCLE_GOPHER.png',
    'MovingGopher.png',
    'NERDY.png',
    'pride_circle.png',
    'STAR_TREK_GOPHER.png',
    'STAY_PUFT_GOPHER.png',
    'This_is_Fine_Gopher.png',
    'Unicorn_Gopher.png'
];

document.getElementById('gopher').src = '/static/img/gophers/' + gophers[Math.round(Math.random()*(gophers.length-1))];
