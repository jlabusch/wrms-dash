# wrms-dash

[![Maintainability](https://api.codeclimate.com/v1/badges/aa20cf63acacc13e2fa0/maintainability)](https://codeclimate.com/github/jlabusch/wrms-dash/maintainability)

This dashboard replaces our previous monthly SLA report documents.

![Screenshot](https://github.com/jlabusch/wrms-dash/raw/master/example.png)

Proper readme still #todo.

For now:

 - Each widget's back end code is at `./api/lib/get_XXX.js`
 - Back end configuration is at `./api/config/default.json` (see also `default.json.example`)
 - There are no public instances of the WRMS database (`db.host`) - get in touch if you need more info
 - To point a widget at a different data source at the front end (i.e. bypassing the Node back end), set `override_uri` in the call to `html/dash.js:query()`
 - check out https://github.com/keen/keen-dataviz.js/blob/master/docs/README.md#chart-types for front-end options, or just use your favourite charting library.

![Architecture](https://github.com/jlabusch/wrms-dash/raw/master/overview.png)

(Note: we don't really use the SSL bits quite as described above, so you'll see SSL turned off in `docker-compose.yml`, `nginx-default.conf` and `Makefile`.)

### Administration

 - Prerequisites: `docker` and `docker-compose`
 - You probably want to set at least two environment variables: `DJANGO_SECRET` and `ICINGA_BASIC_AUTH`
 - To turn on debug mode, export `DJANGO_DEBUG=Y` and/or `API_DEBUG=Y`
 - Run the system with `docker-compose up`, stop it with `docker-compose down`


If you're starting from a blank database, after starting the system you need to:

 - Create a superuser: `docker exec -it wrmsdash_frontend_1 ./manage.py createsuperuser`
 - Note that `frontend/db.sqlite3` will be mounted as a volume

(Note that the actual container name, e.g. `wrmsdash_frontend_1`, depends on your environment. Use `docker-compose ps` to see what the real name is.)

To change a user's password, run `docker exec -it wrmsdash_frontend_1 ./manage.py changepassword <username>`


### WRMS metadata

You can mostly ignore this, but it's possible to move quotes to the SLA budgets of different months using the `invoice_to` field.

Quote ID 1234 can be allocated to the March 2016 SLA budget by saying:

> 1234: 2016-3 SLA

Quote ID 1234 can instead be allocated to Additional Service hours if the SLA budget has been exhausted:

> 1234: 2016-3 Additional

For T&M requests, timesheet adjustments (e.g. writing off new staff training hours) can be added using the "Adjust" keyword... but using adjustments probably means you're doing something wrong, so the exact syntax isn't documented here.


### Thanks

Ashley Mcnamara's Gophers licensed under CC (https://github.com/ashleymcnamara/gophers).


### How to contribute

*Imposter syndrome disclaimer*: I want your help. No really, I do.

There might be a little voice inside that tells you you're not ready; that you need to do one more tutorial, or learn another framework, or write a few more blog posts before you can help me with this project.

I assure you, that's not the case.

If you'd like to throw ideas around before starting any development, happy to do that. If you'd rather start by improving documentation, test coverage or even just giving general feedback, you're very welcome.

Thank you for contributing!
