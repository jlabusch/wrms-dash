# wrms-dash

![Screenshot](https://github.com/jlabusch/wrms-dash/raw/ecs/example.png)

## Brief

This aggregates information about our Service Level Agreements into real-time dashboards we (and our customers!) can use to evaluate account status and manage service delivery.

## Quick start

Prerequisites: `git` and `docker`.

 - `git clone git@github.com:jlabusch/wrms-dash.git`
 - `cd wrms-dash`
 - `git submodule update --init`
 - Create `./config/default.json`
 - `make build`
 - `make start`
 - Browse to http://localhost to test

![Architecture](https://github.com/jlabusch/wrms-dash/raw/ecs/overview.png)

## Initial data load

If you have data to load, e.g. because you dumped the old SQLite version of the DB using `docker exec -it wrms-dash_frontend ./manage.py dumpdata --exclude contenttypes > db.json`, then you can do:

 - copy `db.json` into `./config/`
 - `make config` # copy files into the config volume
 - `make -C wrms-dash-frontend-db build start` # wait for postgres to start
 - `make -C wrms-dash-frontend    build start` # runs initial migrations
 - `docker exec -it wrms-dash-frontend ./manage.py loaddata /opt/db/db.json`

On the other hand, if you don't have anything to import:

 - Start the frontend and frontend-db containers as above
 - `docker exec -it wrms-dash-frontend ./manage.py createsuperuser`

## Volumes

![Architecture](https://github.com/jlabusch/wrms-dash/raw/ecs/volumes.png)

 #### wrms-dash-config-vol
 
 - Built by `wrms-dash`
 - `wrms-dash` copies in everything from `./config/` (usually just `default.json`)
 - `wrms-dash-frontend-db` copies in `pgpass`, which gets a new randomly generated password every time you `make build`

#### wrms-dash-db-vol

 - Built by `wrms-dash-frontend-db`
 - Contains Postgres data files

#### wrms-dash-frontend-vol

 - Built by `wrms-dash-frontend`
 - Contains HTML, CSS and JS files from Django's `staticserve` directory

## Noteworthy environment variables

 - `DJANGO_DEBUG` (`wrms-dash-frontend`) and `DEBUG` (`wrms-dash-api`, `wrms-dash-sync`)
 - `DJANGO_SECRET` (`wrms-dash-frontend`)
 - `ICINGA_BASIC_AUTH` (`wrms-dash-api`)

## Integrations

The dash relies on a few internal systems:

  - Espo CRM for account and contract details (alternative: static JSON config)
  - WRMS for ticket, quote and timesheet information
  - JSON configuration endpoints equivlant to the EU metadata (https://reviews.ci.catalyst-eu.net/#/admin/projects/eumetadata) [Optional]
  - Chkm8 reports for application/plugin patch levels (see https://jenkins-eu.ci.catalyst-eu.net/metadata/updates.json) [Optional]
  - Icinga endpoints for measuring site availability [Optional]
  - Odoo ERP for invoicing reports [Optional]
  - Plugins for reporting user numbers and storage utilisation [Optional, currently exist for Moodle/Mahara/Totara]

User administration is currently done using the standard Django admin interface, but the next step on the roadmap is to back this with WRMS authentication. (There are reasons for not using the Catalyst IdP.)

### Dev notes

 - Each dashboard's widget's back end code is in `wrms-dash-api/lib/get_XXX.js`
 - check out https://github.com/keen/keen-dataviz.js/blob/master/docs/README.md#chart-types for front-end options, or just use your favourite charting library. Google charts also play nicely with this dash.

##### User accounts

To change a user's password, run `docker exec -it wrms-dash_frontend ./manage.py changepassword <username>`

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
