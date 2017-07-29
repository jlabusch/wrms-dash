var default_colors = [
        // teal     red       yellow    purple    orange    mint      blue      green     lavender
        "#00bbde","#fe6672","#eeb058","#8a8ad6","#ff855c","#00cfbb","#5a9eed","#73d483","#c879bb",
        "#0099b6","#d74d58","#cb9141","#6b6bb6","#d86945","#00aa99","#4281c9","#57b566","#ac5c9e",
        "#27cceb","#ff818b","#f6bf71","#9b9be1","#ff9b79","#26dfcd","#73aff4","#87e096","#d88bcb"
        // Catalyst colors:
        // "#5b9aa9", "#e6ad30", "#889a3a", "#ba2025", "#c6b253", "#dd8545", "#50433c"
    ],
    URI_BASE_DEFAULT = 'http://localhost:8004', //'http://mango.btn.catalyst-eu.net:8004',
    SECS = 1000;

var ORG = (function(s){ var a = s.match(/org=([^&]+)/); return a ? a[1] : 1137; })(window.location.search),
    SYS = (function(s){ var a = s.match(/sys=([^&]+)/); return a ? a[1] : 'default'; })(window.location.search),
    DEFAULT_PERIOD = (function(){
        var now     = new Date(),
            YEAR    = now.getFullYear(),
            MONTH   = (now.getMonth()+1)%12;
        return YEAR + '-' + MONTH;
    })(),
    PERIOD = (function(s){ var a = s.match(/period=(\d\d\d\d-\d\d?)/); return a ? a[1] : DEFAULT_PERIOD; })(window.location.search),
    URI_EXT = ORG + '/' + SYS + '/' + PERIOD;

(function(){
    for (var i = 0; i < 5; ++i){
        for (var j = 0; j < 4; ++j){
            [
                $('body > div.container-fluid > div:nth-child(' + i + ') > div:nth-child(' + j + ') > div > div.chart-notes'),
                $('body > div.container-fluid > div:nth-child(' + i + ') > div:nth-child(' + j + ') > div > div.chart-title')
            ].forEach(t => {
                t.text( t.text().replace(/PERIOD/g, PERIOD) );
            });
        }
    }
})();

function query(path, next, override_uri, refresh_interval_secs){
    let xhr = new XMLHttpRequest();
    if (refresh_interval_secs === undefined){
        refresh_interval_secs = 60;
    }
    var uri_base = override_uri || URI_BASE_DEFAULT;

    xhr.open('GET', uri_base + path + '/' + URI_EXT, true);
    xhr.onreadystatechange = function(){
        if (xhr.readyState !== 4){
            return;
        }
        if (xhr.status !== 200){
            next(new Error('' + xhr.status));
            return;
        }
        if (refresh_interval_secs){
            setTimeout(function(){
                query(path, next, override_uri, refresh_interval_secs);
            }, refresh_interval_secs*SECS);
        }
        var json = undefined;
        try{
            json = JSON.parse(xhr.responseText);
        }catch(ex){
            console.log(ex);
        }
        next(null, json || xhr.responseText);
    }
    xhr.send();
}

function render(chart, pre){
    return function(err, data){
        if (err){
            chart.message(err.message);
        }else{
            if (pre){
                pre(chart, data);
            }
            chart.data(data).render();
        }
    }
}

var chart06 = new Keen.Dataviz()
    .el('#chart-06')
    .title('WRs this period')
    .height(250)
    .colors([default_colors[0]])
    .type('metric')
    .prepare();

query('/wrs_created_count', render(chart06));

var chart07 = new Keen.Dataviz()
    .el('#chart-07')
    .title('uptime')
    .height(250)
    .chartOptions({suffix: '%'})
    .type('metric')
    .prepare();

function format_icinga_note(obj){
    if (obj.service.indexOf(obj.host) > -1){
        return obj.service;
    }else{
        return obj.host + '/' + obj.service;
    }
}

query('/availability', render(chart07, function(c, d){
    if (d.error || !d.result){
        d.result = 0;
        console.log(d.error);
        return;
    }
    if (d.host && d.service){
        $('#avail-notes').text(format_icinga_note(d));
    }
    if (d.result < 99.5){
        c.colors([default_colors[1]]);
    }else if (d.result < 99.9){
        c.colors([default_colors[2]]);
    }else{
        c.colors([default_colors[7]]);
    }
}));

var chart09 = new Keen.Dataviz()
    .el('#chart-09')
    .title('disk used')
    .height(250)
    .colors([default_colors[5]])
    .type('metric')
    .prepare();

query('/storage', render(chart09, function(chart, data){
    if (data.error || !data.result){
        data.result = 0;
        console.log(data.error);
        return;
    }
    if (data.host && data.service){
        $('#storage-notes').text(format_icinga_note(data) + ' (' + data.result + 'MB)');
    }
    var GB = 1000,
        TB = 1000*GB;
    if (data.result < GB){
        chart.chartOptions({suffix: 'MB'})
    }else if (data.result < TB){
        data.result = Math.round(data.result/GB*10)/10;
        chart.chartOptions({suffix: 'GB'})
    }else{
        data.result = Math.round(data.result/TB*10)/10;
        chart.chartOptions({suffix: 'TB'})
    }
}));

var chart10 = new Keen.Dataviz()
    .el('#chart-10')
    .colors([default_colors[9]])
    .title('user accounts')
    .height(250)
    .type('metric')
    .prepare();

query('/users', render(chart10));

query('/customer', function(err, data){
    if (!err){
        $('#cust-name').text('[ ' + data.org.name + ' ]');
        $('#cust-system').text('[ ' + data.system.name + ' ]');
    }
});

var chart02 = new Keen.Dataviz()
    .el('#chart-02')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions({
        donut: {
            label: {
                format: function(value, ratio, id){ return value + ' hours'; }
            }
        },
        legend:{ position: 'none' },
        chartArea: {
            height: "85%",
            left: "5%",
            top: "5%",
            width: "100%"
        }
    })
    .prepare();

query('/sla_quotes', render(chart02));

var chart03 = new Keen.Dataviz()
    .el('#chart-03')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions({
        donut: {
            label: {
                format: function(value, ratio, id){ return value + ' hours'; }
            }
        },
        legend:{ position: 'none' },
        chartArea: {
            height: "85%",
            left: "5%",
            top: "5%",
            width: "100%"
        }
    })
    .prepare();

query('/additional_quotes', render(chart03));

google.charts.load('current', {packages: ['corechart', 'bar', 'table']});
google.charts.setOnLoadCallback(draw_custom_charts);

function draw_custom_charts(){
    var common_options = {
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

    query('/sla_hours', function(err, data){
        if (err){
            console.log('sla_hours: ' + err);
            return;
        }

        var o = JSON.parse(JSON.stringify(common_options));
        o.orientation = 'vertical';
        o.chartArea = {height: 200, left: '25%', width: '75%' };
        o.__a = o.hAxis;
        o.hAxis = o.vAxis;
        o.vAxis = o.__a;

        document.getElementById('chart-01-notes').innerText = 'Monthly SLA budget: ' + data.budget + ' hours';

        // Target format is
        //  ['Category', 'Hours', {role: 'style'}],
        //  ['$column_heading', $value, $color],
        //  [...]
        data.result.forEach((row, i) => { row.push(default_colors[i]) });
        data.result.unshift(['Category', 'Hours', {role: 'style'}]);

        var chart01 = new google.visualization.BarChart(document.getElementById('chart-01'));

        chart01.draw(google.visualization.arrayToDataTable(data.result), o);
    });

    var sev_colors = [
        default_colors[7],
        default_colors[0],
        default_colors[2],
        default_colors[10]
    ];

    query('/severity', function(err, data){
        if (err){
            console.log('severity: ' + err);
            return;
        }
        data.forEach((row, i) => { row.push(sev_colors[i]) });
        data.unshift(['Category', 'Number of WRs', {role: 'style'}]);

        var chart04 = new google.visualization.BarChart(document.getElementById('chart-04'));

        chart04.draw(google.visualization.arrayToDataTable(data), common_options);
    });

    query('/response_times', function(err, data){
        if (err){
            console.log('severity: ' + err);
            return;
        }
        if (data.result.length < 2){
            console.log('severity: no data');
            return;
        }
        data.result.forEach((row, i) => { row.push(sev_colors[i]) });
        data.result.unshift(['Category', '95% response time', {role: 'style'}]);

        var chart08 = new google.visualization.BarChart(document.getElementById('chart-08'));

        chart08.draw(google.visualization.arrayToDataTable(data.result), common_options);
    });

    query('/statuses', function(err, data){
        if (err){
            console.log('statuses: ' + err);
            return;
        }
        var o = JSON.parse(JSON.stringify(common_options));
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
        var table = new google.visualization.DataTable();
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('string', 'Status');
        table.addColumn('string', 'Urgency');
        table.addRows(
            data.map(function(row){
                return [
                    'WR ' + row.request_id,
                    row.brief,
                    row.status,
                    row.urgency
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-13'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    });
} // google charts

var gophers = [
    'COWBOY_GOPHER.png',
    'GIRL_GOPHER.png',
    'GO_BUFFALO.png',
    'GOPHERCON.png',
    'GOPHER_DENVER.png',
    'GOPHER_SAFARI.png',
    'LION_GOPHER.png',
    // 'ZERO_FUCKS.png',
    'STAR_TREK_GOPHER.png'
];

document.getElementById('gopher').src = './' + gophers[Math.round(Math.random()*(gophers.length-1))];

