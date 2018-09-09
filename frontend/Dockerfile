FROM python:3.6-stretch

RUN apt-get update && apt-get install -y sqlite3

WORKDIR /opt

COPY requirements.txt /opt/

RUN pip install -r requirements.txt

COPY . /opt/

RUN test -e db.sqlite3 || \
    sqlite3 db.sqlite3 ".databases" && ./manage.py makemigrations && ./manage.py migrate

CMD [ \
    "gunicorn", \
    "-w", "4", \
    "--error-logfile", "-", \
    "--log-level", "info", \
    "-b", "0.0.0.0:80", \
    "--env", "DJANGO_SETTINGS_MODULE=dashboard.settings", \
    "dashboard.wsgi" \
]
