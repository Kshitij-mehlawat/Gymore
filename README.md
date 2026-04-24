# Gymore

Gymore is a fitness management website built with HTML, CSS, JavaScript, Python Flask, and MySQL.

## Features

- User registration and login
- Trainer registration and login
- Admin login and trainer verification
- BMI calculator
- Fitness programs and enrollments
- Gym equipment store
- Cart and demo payment flow
- User, trainer, and admin dashboards

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Python Flask
- Database: MySQL

## Requirements

- Python 3.10 or newer
- MySQL Server
- VS Code or any code editor

## Setup on Windows

Open Command Prompt or PowerShell inside the project folder.

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create the database in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS gymore;
```

Set the database URL in PowerShell:

```powershell
$env:DATABASE_URL="mysql://root:YOUR_PASSWORD@127.0.0.1:3306/gymore"
flask --app app run --debug --port 5001
```

Set the database URL in Command Prompt:

```bat
set DATABASE_URL=mysql://root:YOUR_PASSWORD@127.0.0.1:3306/gymore
flask --app app run --debug --port 5001
```

Open the website:

```text
http://127.0.0.1:5001
```

## Setup on macOS or Linux

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="mysql://root:YOUR_PASSWORD@127.0.0.1:3306/gymore"
flask --app app run --debug --port 5001
```

## Admin Login

```text
Admin ID: 123
Password: 1234
```

## Important Notes

- Do not upload or copy the `venv` folder to another computer.
- On another computer, create a new `venv` and run `pip install -r requirements.txt`.
- The payment screen is a demo payment flow. It does not charge real cards.
- Use dummy card details only.
