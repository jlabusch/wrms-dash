# wrms-dash

[![Code Climate](https://codeclimate.com/github/jlabusch/wrms-dash/badges/gpa.svg)](https://codeclimate.com/github/jlabusch/wrms-dash)

This dashboard replaces our previous monthly SLA report documents.

![Screenshot](https://github.com/jlabusch/wrms-dash/raw/master/example.png)

Proper readme still #todo.

For now:

 - Each widget's back end code is at `./api/lib/get_XXX.js`
 - Back end configuration is at `./api/config/default.json` (see also `default.json.example`)
 - There are no public instances of `sla_uri` and `db.host`; get in touch if you need any more info
 - To point a widget at a different data source at the front end (i.e. bypassing the Node back end), set `override_uri` in the call to `html/dash.js:query()`
 - check out https://github.com/keen/keen-dataviz.js/blob/master/docs/README.md#chart-types for front-end options
 - When running this for real, you need to set at least two environment variables: `DJANGO_SECRET` and `ICINGA_BASIC_AUTH`.


If you're starting from a blank database, after doing `make run` you need to:

 - Create a superuser: `docker exec` into the `frontend` container and run `./manage.py createsuperuser`
 - Copy the DB back to the host: `docker cp wrmsdash_frontend_1:/opt/db.sqlite3 frontend/`
 - Restart the container, which is already configured to mount `frontend/db.sqlite3` as a volume.


Ashley Mcnamara's Gophers licensed under CC (https://github.com/ashleymcnamara/gophers).

### WRMS interface

In addition to reading timesheets and approved quotes, we consult the `invoice_to` field for additional metadata.

Quote ID 1234 can be allocated to the March 2016 SLA budget by saying:

> 1234: 2016-3 SLA

Quote ID 1234 can instead be allocated to Additional Service hours if the SLA budget has been exhausted:

> 1234: 2016-3 Additional

For T&M requests timesheet adjustments (e.g. writing off new staff training hours) can be added using the "Adjust" keyword. While this is possible, using adjustments probably means you're doing something wrong, so the exact syntax isn't documented here.


### How to contribute

*Imposter syndrome disclaimer*: I want your help. No really, I do.

There might be a little voice inside that tells you you're not ready; that you need to do one more tutorial, or learn another framework, or write a few more blog posts before you can help me with this project.

I assure you, that's not the case.

If you'd like to throw ideas around before starting any development, happy to do that. If you'd rather start by improving documentation, test coverage or even just giving general feedback, you're very welcome.

Thank you for contributing!
