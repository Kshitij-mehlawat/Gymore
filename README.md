# Gymore Fitness Platform

Gymore is a comprehensive fitness management platform where users can track their BMI, enroll in courses, and buy equipment. It also features a robust trainer verification workflow and an admin dashboard for platform oversight.

## Features

- **User Dashboard**: Track enrollments, purchase history, and calculate BMI.
- **Trainer Workflow**: 7-question verification process with document upload. Only verified trainers can publish courses.
- **Admin Dashboard**: Review trainer requests, manage users, and track all platform activity.
- **Zen Payment Gateway**: A sleek, multi-step checkout experience for equipment purchases.
- **Motivational UI**: Inspirational quotes to keep users focused on their fitness goals.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (SPA Architecture)
- **Backend**: Python Flask
- **Database**: MySQL

## Getting Started

### Prerequisites

- Python 3.8+
- MySQL Server
- Git

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Gymore.git
   cd Gymore
   ```

2. **Set up a virtual environment**:
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Database Setup**:
   - Create a MySQL database and user.
   - Run the initial setup (the app handles table creation automatically on the first run).

5. **Set Environment Variables**:
   Set your database connection URL:
   ```bash
   # Windows (PowerShell)
   $env:DATABASE_URL="mysql://username:password@localhost:3306/database_name"
   
   # macOS/Linux
   export DATABASE_URL="mysql://username:password@localhost:3306/database_name"
   ```

### Running the Website

```bash
python app.py
```
The website will be available at `http://127.0.0.1:5000`.

## GitHub Deployment

To push this to your GitHub:

1. Create a new repository on GitHub named `Gymore`.
2. Link your local repository to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/Gymore.git
   git branch -M main
   git push -u origin main
   ```

---
*Believe in the process. Your journey starts now.*
