FROM python:3

WORKDIR /opt

COPY requirements.txt /opt/

RUN pip install -r requirements.txt

COPY . /opt/

RUN test -e db.sqlite3 || ./manage.py makemigrations && ./manage.py migrate

CMD ["./manage.py", "runserver", "0.0.0.0:80"]
