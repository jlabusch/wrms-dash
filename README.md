# wrms-dash

![Screenshot](https://github.com/jlabusch/wrms-dash/raw/ecs/example.png)

## Brief

This aggregates information about our Service Level Agreements into real-time dashboards we (and our customers!) can use to evaluate account status and manage service delivery.

It relies on a few internal systems:

  - Espo CRM for account and contract details (alternative: static JSON config)
  - WRMS for ticket, quote and timesheet information
  - JSON configuration endpoints equivlant to the EU metadata (https://reviews.ci.catalyst-eu.net/#/admin/projects/eumetadata) [Optional]
  - Chkm8 reports for application/plugin patch levels (see https://jenkins-eu.ci.catalyst-eu.net/metadata/updates.json) [Optional]
  - Icinga endpoints for measuring site availability [Optional]
  - Odoo ERP for invoicing reports [Optional]
  - Plugins for reporting user numbers and storage utilisation [Optional, currently exist for Moodle/Mahara/Totara]

User administration is currently done using the standard Django admin interface, but the next step on the roadmap is to back this with WRMS authentication. (There are reasons for not using the Catalyst IdP.)

## Quick start

 - Prerequisites: `git`, `docker` and `docker-compose`
 - `git clone git@github.com:jlabusch/wrms-dash.git`
 - `cd wrms-dash`
 - `git submodule update --init`
 - Create `./config/default.json`
 - `make build` to copy `./config/` into a docker volume and build all submodules
 - Decide if you need to set the optional `DJANGO_SECRET` and `ICINGA_BASIC_AUTH` environment variables
 - Export `DJANGO_DEBUG=True` and `DEBUG=Y` if you want to turn on debug logging
 - `make start` to start the system, `make stop` to stop it
 - Browse to http://localhost to test

![Architecture](https://github.com/jlabusch/wrms-dash/raw/ecs/overview.png)


### Migrating from SQlite3 to Postgres

Previous versions of this used SQlite3.

To dump the old SQlite3 data as JSON, use `docker exec -it wrms-dash_frontend ./manage.py dumpdata --exclude contenttypes > db.json`.

To import it into Postgres:

 - start `wrms-dash-frontend-db` and `wrms-dash-frontend`
 - `docker cp db.json wrms-dash-frontend:/opt/`
 - `docker exec -it wrms-dash-frontend ./manage.py loaddata db.json`

### Dev notes

 - Each widget's back end code is at `./api/lib/get_XXX.js`
 - check out https://github.com/keen/keen-dataviz.js/blob/master/docs/README.md#chart-types for front-end options, or just use your favourite charting library. Google charts also play nicely with this dash.

(Note: there is vestigial SSL support, but we haven't touched that in ages because it's solved a different way in our own infrastructure.)

### Administration

If you're starting from a blank database, after starting the system you need to create a superuser: `docker exec -it wrmsdash_frontend_1 ./manage.py createsuperuser`

> Note that `frontend/db.sqlite3` will be mounted as a volume

> Also remember that the actual container name, e.g. `wrmsdash_frontend_1`, depends on your environment. Use `docker-compose ps` to see what the real name is.

##### User accounts

To change a user's password, run `docker exec -it wrmsdash_frontend_1 ./manage.py changepassword <username>`

Current (pre-WRMS IdP) user model is:

- Each organisation has a group whose name is the WRMS org ID
- Client users belong to their organisation's group and no permissions
- Staff users have the "staff status" and "superuser status" options checked and no groups or additional permissions

### WRMS metadata

We use a few conventions within WRMS:

 - By default work is funded from the SLA budget dictated by the contract and stored in the CRM
 - Additional work beyond the scope of the SLA can be marked as such by adding the "Additional" tag to the WR. This work won't be counted in the "hours remaining" widget.
 - WRs with approved quotes will be treated as strictly fixed price, with all timesheet hours ignored
 - WRs tagged with "Warranty" or "Maintenance" won't have their timesheet hours counted regardless of quotes
 - The `invoice_to` field can reclassify individual quotes as belonging to a different time period or budget (SLA vs. Additional service hours.)

Using `invoice_to` quote 1234 can be allocated to the March 2016 SLA budget by saying:

> 1234: 2016-3 SLA

Quote 1234 can instead be allocated to Additional service hours with:

> 1234: 2016-3 Additional

For T&M requests, timesheet adjustments (e.g. writing off new staff training hours) can be added using the "Adjust" keyword... but using adjustments probably means you're doing something wrong, and the exact syntax isn't documented here.

### Thanks

Ashley Mcnamara's Gophers licensed under CC (https://github.com/ashleymcnamara/gophers).

### How to contribute

*Imposter syndrome disclaimer*: I want your help. No really, I do.

There might be a little voice inside that tells you you're not ready; that you need to do one more tutorial, or learn another framework, or write a few more blog posts before you can help me with this project.

I assure you, that's not the case.

If you'd like to throw ideas around before starting any development, happy to do that. If you'd rather start by improving documentation, test coverage or even just giving general feedback, you're very welcome.

Thank you for contributing!
