FROM python:3

WORKDIR /opt

COPY requirements.txt /opt/

RUN pip install -r requirements.txt

COPY . /opt/

CMD ["./manage.py", "runserver", "0.0.0.0:80"]
