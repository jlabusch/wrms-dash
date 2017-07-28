# wrms-dash

[![Code Climate](https://codeclimate.com/github/jlabusch/wrms-dash/badges/gpa.svg)](https://codeclimate.com/github/jlabusch/wrms-dash)

This dashboard replaces our previous monthly SLA report documents.

![Screenshot](https://github.com/jlabusch/wrms-dash/raw/master/example.png)

Proper readme still #todo.

For now:

 - Each widget's back end code is at `./app/lib/get_XXX.js`
 - Back end configuration is at `./app/config/default.json`
 - There are no public instances of `sla_uri` and `db.host`; get in touch if you need any more info
 - To point a widget at a different data source at the front end (i.e. bypassing the Node back end), set `override_uri` in the call to `html/dash.js:query()`
 - check out https://github.com/keen/keen-dataviz.js/blob/master/docs/README.md#chart-types for front-end options

Ashley Mcnamara's Gophers licensed under CC (https://github.com/ashleymcnamara/gophers).
