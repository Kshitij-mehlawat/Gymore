import os
import time
from pathlib import Path
from urllib.parse import urlparse

import pymysql
from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder="static", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "gymore_secret_key_123")
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "uploads", "verification_documents")
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
ADMIN_LOGIN_ID = "123"
ADMIN_LOGIN_PASSWORD = "1234"
TRAINER_STATUSES = {"unverified", "pending", "verified", "rejected", "blacklisted"}
STATUS_LABELS = {
    "unverified": "Unverified",
    "pending": "Pending Review",
    "verified": "Verified",
    "rejected": "Rejected",
    "blacklisted": "Blacklisted",
}
ALLOWED_PROOF_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_SUBDIR = Path("uploads") / "verification_documents"
UPLOAD_DIR = STATIC_DIR / UPLOAD_SUBDIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

EQUIPMENT_ITEMS = [
    {
        "id": 1,
        "name": "Adjustable Dumbbells",
        "price": 14999,
        "description": "Space-saving dumbbells for home strength workouts.",
        "image": "https://montrealweights.ca/cdn/shop/articles/788c2071-2172-4b8a-8544-92407fe89a3e-1691165964508_ab6232e5-9b23-4e33-a10e-22234003b35e.jpg?v=1691177428",
    },
    {
        "id": 2,
        "name": "Olympic Barbell",
        "price": 11999,
        "description": "Strong steel barbell for squats, presses, and deadlifts.",
        "image": "https://ca.ironbullstrength.com/cdn/shop/articles/07373b86d441342fbac44a2e7a819f5c_e3479a67-5716-4959-b290-18f968aeb61a.jpg?v=1756367656&width=832",
    },
    {
        "id": 3,
        "name": "Kettlebell Set",
        "price": 6999,
        "description": "Useful for swings, carries, and full-body conditioning.",
        "image": "https://wolverson-fitness.co.uk/cdn/shop/files/bskb-11_e621930c-d58c-40e2-9027-cd037a0db758.jpg?v=1773227255",
    },
    {
        "id": 4,
        "name": "Resistance Bands",
        "price": 1499,
        "description": "Portable training bands for warm-up and resistance exercises.",
        "image": "https://www.wodarmour.in/cdn/shop/products/resistance-training-bands-wodarmour-6.jpg?v=1757154726&width=960",
    },
    {
        "id": 5,
        "name": "Workout Bench",
        "price": 8999,
        "description": "Flat and incline bench for presses, rows, and dumbbell work.",
        "image": "https://atlantisstrength.com/app/uploads/2022/01/bench-press-scaled-1248x924.jpg",
    },
    {
        "id": 6,
        "name": "Yoga Mat",
        "price": 999,
        "description": "Comfortable mat for stretching, yoga, and core training.",
        "image": "https://m.media-amazon.com/images/I/51nOeHEcgDL._SX679_.jpg",
    },
]


def connect_db():
    if not DATABASE_URL:
        raise RuntimeError("Set DATABASE_URL first to connect with MySQL.")

    parsed = urlparse(DATABASE_URL)

    return pymysql.connect(
        host=parsed.hostname or "127.0.0.1",
        port=parsed.port or 3306,
        user=parsed.username or "root",
        password=parsed.password or "",
        database=parsed.path.lstrip("/"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def api_response(data=None, message=None, status=200):
    payload = {"ok": 200 <= status < 300}
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    return jsonify(payload), status


def api_error(message, status=400):
    return api_response(message=message, status=status)


def read_json():
    return request.get_json(silent=True) or {}


def make_slug(text):
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in text).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "course"


def get_current_user():
    return session.get("user")


def save_user_session(user):
    session["user"] = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    }


def require_user_role():
    user = get_current_user()
    if not user:
        return None, api_error("Please log in first.", 401)
    if user["role"] != "user":
        return None, api_error("Only users can access this action.", 403)
    return user, None


def require_trainer_role():
    user = get_current_user()
    if not user:
        return None, api_error("Please log in as a trainer first.", 401)
    if user["role"] != "trainer":
        return None, api_error("Only trainers can access this action.", 403)
    return user, None


def require_admin_role():
    user = get_current_user()
    if not user:
        return None, api_error("Please log in as admin first.", 401)
    if user["role"] != "admin":
        return None, api_error("Only admins can access this action.", 403)
    return user, None


def get_equipment_by_id(item_id):
    for item in EQUIPMENT_ITEMS:
        if item["id"] == item_id:
            return item
    return None


def get_cart():
    return session.get("cart", {})


def save_cart(cart):
    session["cart"] = cart
    session.modified = True


def get_cart_items():
    cart = get_cart()
    items = []
    total = 0

    for item in EQUIPMENT_ITEMS:
        quantity = cart.get(str(item["id"]), 0)
        if quantity <= 0:
            continue

        subtotal = item["price"] * quantity
        items.append(
            {
                "id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "description": item["description"],
                "image": item["image"],
                "quantity": quantity,
                "subtotal": subtotal,
            }
        )
        total += subtotal

    return items, total


def get_cart_count():
    return sum(get_cart().values())


def get_unique_slug(cursor, title, course_id=None):
    slug = make_slug(title)
    new_slug = slug
    count = 2

    while True:
        if course_id is None:
            cursor.execute("SELECT id FROM courses WHERE slug = %s", (new_slug,))
        else:
            cursor.execute("SELECT id FROM courses WHERE slug = %s AND id != %s", (new_slug, course_id))

        old_course = cursor.fetchone()
        if not old_course:
            return new_slug

        new_slug = f"{slug}-{count}"
        count += 1


def get_course_form_data():
    data = read_json()
    return {
        "title": data.get("title", "").strip(),
        "description": data.get("description", "").strip(),
        "duration": data.get("duration", "").strip(),
        "level": data.get("level", "").strip(),
    }


def course_form_has_empty_field(form):
    return any(value == "" for value in form.values())


def calculate_bmi_result(weight, height_cm):
    height_m = height_cm / 100
    bmi_value = weight / (height_m * height_m)

    if bmi_value < 18.5:
        category = "Underweight"
    elif bmi_value < 25:
        category = "Normal"
    elif bmi_value < 30:
        category = "Overweight"
    else:
        category = "Obese"

    return {"bmi": round(bmi_value, 1), "category": category}


def allowed_proof_file(filename):
    if "." not in filename:
        return False
    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_PROOF_EXTENSIONS


def word_count(text):
    return len([word for word in text.strip().split() if word])


def build_proof_image_url(relative_path):
    if not relative_path:
        return None
    return f"/static/{relative_path}"


def save_verification_proof(file_storage, trainer_id):
    original_name = secure_filename(file_storage.filename or "")
    if original_name == "" or not allowed_proof_file(original_name):
        raise ValueError("Please upload a valid image file for question 7.")

    filename = f"trainer_{trainer_id}_{int(time.time())}_{original_name}"
    relative_path = (UPLOAD_SUBDIR / filename).as_posix()
    file_storage.save(UPLOAD_DIR / filename)
    return relative_path


def serialize_trainer_profile(profile):
    status = profile["status"]
    return {
        "user_id": profile["user_id"],
        "full_name": profile.get("full_name"),
        "status": status,
        "status_label": STATUS_LABELS.get(status, "Unverified"),
        "preferred_course_type": profile.get("preferred_course_type"),
        "average_fee": profile.get("average_fee"),
        "teaching_summary": profile.get("teaching_summary"),
        "latest_request_id": profile.get("latest_request_id"),
        "review_note": profile.get("review_note"),
        "reviewed_at": profile.get("reviewed_at"),
        "can_verify": status == "unverified",
        "can_manage_content": status == "verified",
    }


def get_trainer_profile(cursor, trainer_id):
    cursor.execute("INSERT IGNORE INTO trainer_profiles (user_id) VALUES (%s)", (trainer_id,))
    cursor.execute(
        """
        SELECT user_id, full_name, status, preferred_course_type, average_fee,
               teaching_summary, latest_request_id, review_note, reviewed_at
        FROM trainer_profiles
        WHERE user_id = %s
        """,
        (trainer_id,),
    )
    return serialize_trainer_profile(cursor.fetchone())


def trainer_upload_error_message(status):
    if status == "pending":
        return "Your verification request is pending admin review. You cannot upload courses yet."
    if status == "rejected":
        return "Your verification request was rejected. You cannot submit another request or upload courses."
    if status == "blacklisted":
        return "Your trainer account is blacklisted. You cannot upload courses."
    return "You must first verify your trainer account before uploading courses."


def ensure_trainer_can_manage_content(cursor, trainer_id):
    profile = get_trainer_profile(cursor, trainer_id)
    if profile["status"] != "verified":
        return profile, api_error(trainer_upload_error_message(profile["status"]), 403)
    return profile, None


def get_user_purchase_history(cursor, user_id):
    cursor.execute(
        """
        SELECT equipment_orders.id AS order_id,
               equipment_orders.total_amount,
               equipment_orders.full_name,
               equipment_orders.address,
               equipment_orders.pincode,
               equipment_orders.phone,
               equipment_orders.created_at,
               equipment_order_items.equipment_name,
               equipment_order_items.quantity,
               equipment_order_items.subtotal
        FROM equipment_orders
        JOIN equipment_order_items ON equipment_order_items.order_id = equipment_orders.id
        WHERE equipment_orders.user_id = %s
        ORDER BY equipment_orders.created_at DESC, equipment_order_items.id ASC
        """,
        (user_id,),
    )
    rows = cursor.fetchall()
    orders = []
    order_map = {}

    for row in rows:
        order = order_map.get(row["order_id"])
        if order is None:
            order = {
                "order_id": row["order_id"],
                "total_amount": row["total_amount"],
                "full_name": row["full_name"],
                "address": row["address"],
                "pincode": row["pincode"],
                "phone": row["phone"],
                "created_at": row["created_at"],
                "items": [],
            }
            order_map[row["order_id"]] = order
            orders.append(order)

        order["items"].append(
            {
                "equipment_name": row["equipment_name"],
                "quantity": row["quantity"],
                "subtotal": row["subtotal"],
            }
        )

    return orders


def get_trainer_course_activity(cursor, trainer_id):
    cursor.execute(
        """
        SELECT courses.id, courses.title, courses.description, courses.duration, courses.level,
               COUNT(enrollments.id) AS enrollment_count
        FROM courses
        LEFT JOIN enrollments ON enrollments.course_id = courses.id
        WHERE courses.created_by = %s
        GROUP BY courses.id
        ORDER BY courses.created_at DESC, courses.id DESC
        """,
        (trainer_id,),
    )
    courses = cursor.fetchall()

    cursor.execute(
        """
        SELECT courses.id AS course_id, users.username, users.email, enrollments.enrolled_at
        FROM courses
        JOIN enrollments ON enrollments.course_id = courses.id
        JOIN users ON users.id = enrollments.user_id
        WHERE courses.created_by = %s
        ORDER BY enrollments.enrolled_at DESC
        """,
        (trainer_id,),
    )
    learner_rows = cursor.fetchall()
    learners_by_course = {}

    for row in learner_rows:
        learners_by_course.setdefault(row["course_id"], []).append(
            {
                "username": row["username"],
                "email": row["email"],
                "enrolled_at": row["enrolled_at"],
            }
        )

    for course in courses:
        course["learners"] = learners_by_course.get(course["id"], [])

    return courses


def get_trainer_request_list(cursor):
    cursor.execute(
        """
        SELECT trainer_verification_requests.id,
               trainer_verification_requests.trainer_id,
               trainer_verification_requests.full_name,
               trainer_verification_requests.status,
               trainer_verification_requests.submitted_at,
               users.username AS trainer_username
        FROM trainer_verification_requests
        JOIN users ON users.id = trainer_verification_requests.trainer_id
        ORDER BY
            CASE WHEN trainer_verification_requests.status = 'pending' THEN 0 ELSE 1 END,
            trainer_verification_requests.id ASC
        """
    )
    requests = cursor.fetchall()
    for item in requests:
        item["status_label"] = STATUS_LABELS.get(item["status"], item["status"].title())
    return requests


def get_trainer_request_detail(cursor, request_id):
    cursor.execute(
        """
        SELECT trainer_verification_requests.*,
               users.username AS trainer_username,
               users.email AS trainer_email
        FROM trainer_verification_requests
        JOIN users ON users.id = trainer_verification_requests.trainer_id
        WHERE trainer_verification_requests.id = %s
        """,
        (request_id,),
    )
    item = cursor.fetchone()
    if not item:
        return None

    item["status_label"] = STATUS_LABELS.get(item["status"], item["status"].title())
    item["proof_image_url"] = build_proof_image_url(item["proof_image_path"])
    return item


def build_admin_dashboard_data(cursor, admin_user):
    cursor.execute("SELECT COUNT(*) AS total_users FROM users WHERE role = 'user'")
    total_users = cursor.fetchone()["total_users"]

    cursor.execute("SELECT COUNT(*) AS total_trainers FROM users WHERE role = 'trainer'")
    total_trainers = cursor.fetchone()["total_trainers"]

    cursor.execute("SELECT COUNT(*) AS pending_requests FROM trainer_verification_requests WHERE status = 'pending'")
    pending_requests = cursor.fetchone()["pending_requests"]

    cursor.execute("SELECT COUNT(*) AS verified_trainers FROM trainer_profiles WHERE status = 'verified'")
    verified_trainers = cursor.fetchone()["verified_trainers"]

    cursor.execute("SELECT COUNT(*) AS total_orders FROM equipment_orders")
    total_orders = cursor.fetchone()["total_orders"]

    cursor.execute(
        """
        SELECT id, username, email, created_at
        FROM users
        WHERE role = 'user'
        ORDER BY created_at DESC, id DESC
        """
    )
    users = cursor.fetchall()
    user_activity = []
    for item in users:
        cursor.execute(
            """
            SELECT courses.id, courses.title, courses.duration, courses.level,
                   courses.trainer_name, enrollments.enrolled_at
            FROM enrollments
            JOIN courses ON courses.id = enrollments.course_id
            WHERE enrollments.user_id = %s
            ORDER BY enrollments.enrolled_at DESC
            """,
            (item["id"],),
        )
        enrollments = cursor.fetchall()
        purchases = get_user_purchase_history(cursor, item["id"])
        user_activity.append(
            {
                "id": item["id"],
                "username": item["username"],
                "email": item["email"],
                "created_at": item["created_at"],
                "enrollments": enrollments,
                "purchases": purchases,
            }
        )

    cursor.execute(
        """
        SELECT users.id, users.username, users.email, users.created_at
        FROM users
        WHERE users.role = 'trainer'
        ORDER BY users.created_at DESC, users.id DESC
        """
    )
    trainers = cursor.fetchall()
    trainer_activity = []
    for trainer in trainers:
        profile = get_trainer_profile(cursor, trainer["id"])
        courses = get_trainer_course_activity(cursor, trainer["id"])
        trainer_activity.append(
            {
                "id": trainer["id"],
                "username": trainer["username"],
                "email": trainer["email"],
                "created_at": trainer["created_at"],
                "profile": profile,
                "courses": courses,
                "course_count": len(courses),
                "enrollment_count": sum(course["enrollment_count"] for course in courses),
            }
        )

    return {
        "user": admin_user,
        "summary": {
            "total_users": total_users,
            "total_trainers": total_trainers,
            "pending_requests": pending_requests,
            "verified_trainers": verified_trainers,
            "total_orders": total_orders,
        },
        "users": user_activity,
        "trainers": trainer_activity,
        "trainer_requests": get_trainer_request_list(cursor),
    }


def init_db():
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS courses (
            id INT PRIMARY KEY AUTO_INCREMENT,
            slug VARCHAR(255) UNIQUE NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            duration VARCHAR(255) NOT NULL,
            level VARCHAR(255) NOT NULL,
            trainer_name VARCHAR(255) NOT NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS enrollments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            course_id INT NOT NULL,
            enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_enrollment (user_id, course_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS trainer_profiles (
            user_id INT PRIMARY KEY,
            full_name VARCHAR(255) NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'unverified',
            preferred_course_type VARCHAR(100) NULL,
            teaching_summary TEXT NULL,
            latest_request_id INT NULL,
            review_note TEXT NULL,
            reviewed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS trainer_verification_requests (
            id INT PRIMARY KEY AUTO_INCREMENT,
            trainer_id INT NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            training_experience VARCHAR(255) NOT NULL,
            previous_gyms TEXT NOT NULL,
            gym_journey VARCHAR(255) NOT NULL,
            course_type VARCHAR(100) NOT NULL,
            teaching_summary TEXT NOT NULL,
            proof_image_path VARCHAR(500) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            admin_note TEXT NULL,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at DATETIME NULL,
            FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS equipment_orders (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            total_amount INT NOT NULL,
            full_name VARCHAR(255) NULL,
            address TEXT NULL,
            pincode VARCHAR(20) NULL,
            phone VARCHAR(20) NULL,
            payment_status VARCHAR(50) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS equipment_order_items (
            id INT PRIMARY KEY AUTO_INCREMENT,
            order_id INT NOT NULL,
            equipment_id INT NOT NULL,
            equipment_name VARCHAR(255) NOT NULL,
            price INT NOT NULL,
            quantity INT NOT NULL,
            subtotal INT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES equipment_orders(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        INSERT IGNORE INTO trainer_profiles (user_id)
        SELECT users.id
        FROM users
        WHERE users.role = 'trainer'
        """
    )

    default_courses = [
        (
            "fat-loss-sprint",
            "Fat Loss Sprint",
            "HIIT-focused cut cycle with recovery days to protect strength.",
            "3 weeks",
            "Challenging",
            "Gymore Team",
        ),
        (
            "hypertrophy-12-week",
            "Hypertrophy 12-Week",
            "Push, pull, legs programming with progressive volume and tempo work.",
            "12 weeks",
            "Moderate",
            "Gymore Team",
        ),
        (
            "endurance-builder",
            "Endurance Builder",
            "Aerobic base work that mixes steady-state sessions and interval training.",
            "8 weeks",
            "Moderate",
            "Gymore Team",
        ),
    ]

    for course in default_courses:
        cursor.execute(
            """
            INSERT IGNORE INTO courses (slug, title, description, duration, level, trainer_name, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, NULL)
            """,
            course,
        )

    # Ensure equipment_orders has shipping columns
    cursor.execute("SHOW COLUMNS FROM equipment_orders LIKE 'full_name'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE equipment_orders ADD COLUMN full_name VARCHAR(255) NULL")
        cursor.execute("ALTER TABLE equipment_orders ADD COLUMN address TEXT NULL")
        cursor.execute("ALTER TABLE equipment_orders ADD COLUMN pincode VARCHAR(20) NULL")
        cursor.execute("ALTER TABLE equipment_orders ADD COLUMN phone VARCHAR(20) NULL")
        cursor.execute("ALTER TABLE equipment_orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'completed'")

    # Clean up any courses from unverified/blacklisted trainers
    cursor.execute(
        """
        DELETE FROM courses 
        WHERE created_by IN (
            SELECT user_id FROM trainer_profiles WHERE status != 'verified'
        )
        """
    )

    conn.commit()
    cursor.close()
    conn.close()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def frontend_routes(path):
    if path.startswith("api/"):
        return api_error("API route not found.", 404)
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/session")
def session_state():
    return api_response(
        {
            "user": get_current_user(),
            "cart_count": get_cart_count(),
        }
    )


@app.route("/api/home")
def home():
    conn = connect_db()
    cursor = conn.cursor()
    # Only show courses created by Gymore Team (NULL created_by) 
    # OR courses created by VERIFIED trainers
    cursor.execute(
        """
        SELECT courses.*, 
               (SELECT COUNT(*) FROM enrollments WHERE course_id = courses.id) AS enrollment_count
        FROM courses
        LEFT JOIN trainer_profiles ON courses.created_by = trainer_profiles.user_id
        WHERE courses.created_by IS NULL 
           OR trainer_profiles.status = 'verified'
        ORDER BY courses.created_at DESC
        LIMIT 3
        """
    )
    featured_courses = cursor.fetchall()
    cursor.close()
    conn.close()
    return api_response({"featured_courses": featured_courses})


@app.route("/api/auth/register", methods=["POST"])
def register_account():
    data = read_json()
    role = data.get("role", "user").strip()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if role not in {"user", "trainer"}:
        return api_error("Invalid role selected.")

    if username == "" or email == "" or password == "":
        return api_error("Please fill all fields.")

    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users (username, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
            """,
            (username, email, generate_password_hash(password), role),
        )
        user_id = cursor.lastrowid

        if role == "trainer":
            cursor.execute(
                """
                INSERT IGNORE INTO trainer_profiles (user_id, status)
                VALUES (%s, 'unverified')
                """,
                (user_id,),
            )

        conn.commit()
    except pymysql.IntegrityError:
        conn.rollback()
        return api_error("Username or email already exists.", 409)
    finally:
        cursor.close()
        conn.close()

    return api_response(message="Account created successfully. Please sign in.", status=201)


@app.route("/api/auth/login", methods=["POST"])
def login_account():
    data = read_json()
    role = data.get("role", "user").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if role == "admin":
        if username != ADMIN_LOGIN_ID or password != ADMIN_LOGIN_PASSWORD:
            return api_error("Invalid admin credentials.", 401)

        save_user_session({"id": ADMIN_LOGIN_ID, "username": "Admin", "role": "admin"})
        return api_response(
            {
                "user": get_current_user(),
                "cart_count": get_cart_count(),
            },
            message="Signed in successfully.",
        )

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = %s AND role = %s", (username, role))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return api_error("Invalid credentials.", 401)

    save_user_session(user)
    return api_response(
        {
            "user": get_current_user(),
            "cart_count": get_cart_count(),
        },
        message="Signed in successfully.",
    )


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return api_response(message="You have been logged out.")


@app.route("/api/dashboard")
def dashboard():
    user, response = require_user_role()
    if response:
        return response

    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT courses.id, courses.title, courses.duration, courses.level,
               courses.trainer_name, enrollments.enrolled_at
        FROM enrollments
        JOIN courses ON courses.id = enrollments.course_id
        WHERE enrollments.user_id = %s
        ORDER BY enrollments.enrolled_at DESC
        """,
        (user["id"],),
    )
    enrollments = cursor.fetchall()

    cursor.execute(
        """
        SELECT courses.id, courses.title, courses.duration, courses.level, courses.trainer_name
        FROM courses
        WHERE courses.id NOT IN (
            SELECT course_id FROM enrollments WHERE user_id = %s
        )
        ORDER BY courses.created_at DESC, courses.id DESC
        LIMIT 4
        """,
        (user["id"],),
    )
    available_courses = cursor.fetchall()
    purchases = get_user_purchase_history(cursor, user["id"])

    cursor.close()
    conn.close()
    return api_response(
        {
            "user": user,
            "enrollments": enrollments,
            "available_courses": available_courses,
            "purchases": purchases,
        }
    )


@app.route("/api/trainer/dashboard")
def trainer_dashboard():
    user, response = require_trainer_role()
    if response:
        return response

    conn = connect_db()
    cursor = conn.cursor()
    trainer_profile = get_trainer_profile(cursor, user["id"])
    courses = get_trainer_course_activity(cursor, user["id"])
    cursor.close()
    conn.close()

    total_enrollments = sum(course["enrollment_count"] for course in courses)

    return api_response(
        {
            "user": user,
            "trainer_profile": trainer_profile,
            "courses": courses,
            "totals": {
                "courses": len(courses),
                "enrollments": total_enrollments,
            },
        }
    )


@app.route("/api/trainer/verification-request", methods=["POST"])
def submit_trainer_verification_request():
    user, response = require_trainer_role()
    if response:
        return response

    full_name = request.form.get("full_name", "").strip()
    training_experience = request.form.get("training_experience", "").strip()
    previous_gyms = request.form.get("previous_gyms", "").strip()
    gym_journey = request.form.get("gym_journey", "").strip()
    course_type = request.form.get("course_type", "").strip()
    teaching_summary = request.form.get("teaching_summary", "").strip()
    proof_image = request.files.get("proof_image")

    if not all(
        [
            full_name,
            training_experience,
            previous_gyms,
            gym_journey,
            course_type,
            teaching_summary,
        ]
    ):
        return api_error("Please answer all verification questions.")

    if word_count(teaching_summary) > 100:
        return api_error("Question 6 must stay under 100 words.")

    if proof_image is None or proof_image.filename == "":
        return api_error("Please upload your proof image for question 7.")

    conn = connect_db()
    cursor = conn.cursor()
    profile = get_trainer_profile(cursor, user["id"])

    if profile["status"] == "pending":
        cursor.close()
        conn.close()
        return api_error("Your verification request is already pending admin review.", 409)

    if profile["status"] == "verified":
        cursor.close()
        conn.close()
        return api_error("Your trainer account is already verified.", 409)

    if profile["status"] == "rejected":
        cursor.close()
        conn.close()
        return api_error("Your verification request was rejected. You cannot submit another request.", 403)

    if profile["status"] == "blacklisted":
        cursor.close()
        conn.close()
        return api_error("Your trainer account is blacklisted and cannot submit verification requests.", 403)

    try:
        proof_image_path = save_verification_proof(proof_image, user["id"])
    except ValueError as error:
        cursor.close()
        conn.close()
        return api_error(str(error))

    cursor.execute(
        """
        INSERT INTO trainer_verification_requests (
            trainer_id, full_name, training_experience, previous_gyms, gym_journey,
            course_type, average_fee, teaching_summary, proof_image_path, status
        )
        VALUES (%s, %s, %s, %s, %s, %s, '', %s, %s, 'pending')
        """,
        (
            user["id"],
            full_name,
            training_experience,
            previous_gyms,
            gym_journey,
            course_type,
            teaching_summary,
            proof_image_path,
        ),
    )
    request_id = cursor.lastrowid

    cursor.execute(
        """
        UPDATE trainer_profiles
        SET full_name = %s,
            status = 'pending',
            preferred_course_type = %s,
            average_fee = '',
            teaching_summary = %s,
            latest_request_id = %s,
            review_note = NULL,
            reviewed_at = NULL
        WHERE user_id = %s
        """,
        (
            full_name,
            course_type,
            teaching_summary,
            request_id,
            user["id"],
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()

    return api_response(message="Verification request submitted successfully. Please wait for admin review.", status=201)


@app.route("/api/admin/dashboard")
def admin_dashboard():
    admin_user, response = require_admin_role()
    if response:
        return response

    conn = connect_db()
    cursor = conn.cursor()
    data = build_admin_dashboard_data(cursor, admin_user)
    cursor.close()
    conn.close()
    return api_response(data)


@app.route("/api/admin/requests/<int:request_id>")
def admin_request_detail(request_id):
    _, response = require_admin_role()
    if response:
        return response

    conn = connect_db()
    cursor = conn.cursor()
    detail = get_trainer_request_detail(cursor, request_id)
    cursor.close()
    conn.close()

    if not detail:
        return api_error("Trainer request not found.", 404)

    return api_response({"request": detail})


@app.route("/api/admin/requests/<int:request_id>/decision", methods=["POST"])
def admin_request_decision(request_id):
    _, response = require_admin_role()
    if response:
        return response

    data = read_json()
    decision = data.get("decision", "").strip().lower()

    if decision not in {"accept", "reject"}:
        return api_error("Invalid admin decision.")

    conn = connect_db()
    cursor = conn.cursor()
    detail = get_trainer_request_detail(cursor, request_id)
    if not detail:
        cursor.close()
        conn.close()
        return api_error("Trainer request not found.", 404)

    if detail["status"] != "pending":
        cursor.close()
        conn.close()
        return api_error("This trainer request has already been reviewed.", 409)

    new_status = "verified" if decision == "accept" else "rejected"
    request_status = "accepted" if decision == "accept" else "rejected"
    review_note = "Accepted by admin." if decision == "accept" else "Rejected by admin."

    cursor.execute(
        """
        UPDATE trainer_verification_requests
        SET status = %s,
            admin_note = %s,
            reviewed_at = NOW()
        WHERE id = %s
        """,
        (request_status, review_note, request_id),
    )

    cursor.execute(
        """
        UPDATE trainer_profiles
        SET full_name = %s,
            status = %s,
            preferred_course_type = %s,
            average_fee = '',
            teaching_summary = %s,
            latest_request_id = %s,
            review_note = %s,
            reviewed_at = NOW()
        WHERE user_id = %s
        """,
        (
            detail["full_name"],
            new_status,
            detail["course_type"],
            detail["teaching_summary"],
            detail["id"],
            review_note,
            detail["trainer_id"],
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()

    message = "Trainer verified successfully." if decision == "accept" else "Trainer request rejected successfully."
    return api_response(message=message)


@app.route("/api/admin/trainers/<int:trainer_id>/status", methods=["POST"])
def admin_update_trainer_status(trainer_id):
    _, response = require_admin_role()
    if response:
        return response

    data = read_json()
    action = data.get("action", "").strip().lower()
    if action not in {"unverified", "blacklisted"}:
        return api_error("Invalid trainer action.")

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users WHERE id = %s AND role = 'trainer'", (trainer_id,))
    trainer = cursor.fetchone()
    if not trainer:
        cursor.close()
        conn.close()
        return api_error("Trainer not found.", 404)

    profile = get_trainer_profile(cursor, trainer_id)
    if profile["status"] == "rejected" and action == "unverified":
        cursor.close()
        conn.close()
        return api_error("Rejected trainers cannot be changed back to unverified from this control.", 409)

    review_note = "Trainer was unverified by admin." if action == "unverified" else "Trainer was blacklisted by admin."
    cursor.execute(
        """
        UPDATE trainer_profiles
        SET status = %s,
            review_note = %s,
            reviewed_at = NOW()
        WHERE user_id = %s
        """,
        (action, review_note, trainer_id),
    )
    conn.commit()
    cursor.close()
    conn.close()

    message = "Trainer moved back to unverified." if action == "unverified" else "Trainer blacklisted successfully."
    return api_response(message=message)


@app.route("/api/bmi", methods=["POST"])
def bmi():
    data = read_json()

    try:
        weight = float(data.get("weight", 0))
        height_cm = float(data.get("height", 0))
        if weight <= 0 or height_cm <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return api_error("Enter valid numbers for weight and height.")

    return api_response(calculate_bmi_result(weight, height_cm))


@app.route("/api/equipment")
def equipment():
    return api_response({"items": EQUIPMENT_ITEMS, "cart_count": get_cart_count()})


@app.route("/api/cart")
def cart():
    cart_items, total = get_cart_items()
    return api_response({"items": cart_items, "total": total, "cart_count": get_cart_count()})


@app.route("/api/cart/add/<int:item_id>", methods=["POST"])
def add_to_cart(item_id):
    item = get_equipment_by_id(item_id)
    if not item:
        return api_error("Equipment item not found.", 404)

    cart = get_cart()
    item_key = str(item_id)
    cart[item_key] = cart.get(item_key, 0) + 1
    save_cart(cart)

    cart_items, total = get_cart_items()
    return api_response(
        {
            "items": cart_items,
            "total": total,
            "cart_count": get_cart_count(),
        },
        message=f"{item['name']} added to cart.",
    )


@app.route("/api/cart/remove/<int:item_id>", methods=["POST"])
def remove_from_cart(item_id):
    cart = get_cart()
    item_key = str(item_id)

    if item_key in cart:
        del cart[item_key]
        save_cart(cart)

    cart_items, total = get_cart_items()
    return api_response(
        {
            "items": cart_items,
            "total": total,
            "cart_count": get_cart_count(),
        },
        message="Item removed from cart.",
    )


@app.route("/api/cart/buy", methods=["POST"])
def buy_cart():
    user, response = require_user_role()
    if response:
        return response

    data = request.json
    full_name = data.get("full_name")
    address = data.get("address")
    pincode = data.get("pincode")
    phone = data.get("phone")

    if not all([full_name, address, pincode, phone]):
        return api_error("Please provide all shipping details.")

    cart_items, total = get_cart_items()
    if not cart_items:
        return api_error("Your cart is empty.")

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO equipment_orders (user_id, total_amount, full_name, address, pincode, phone, payment_status)
        VALUES (%s, %s, %s, %s, %s, %s, 'completed')
        """,
        (user["id"], total, full_name, address, pincode, phone),
    )
    order_id = cursor.lastrowid

    for item in cart_items:
        cursor.execute(
            """
            INSERT INTO equipment_order_items (order_id, equipment_id, equipment_name, price, quantity, subtotal)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (order_id, item["id"], item["name"], item["price"], item["quantity"], item["subtotal"]),
        )

    conn.commit()
    cursor.close()
    conn.close()

    save_cart({})
    return api_response(
        {
            "items": [],
            "total": 0,
            "cart_count": 0,
        },
        message=f"Purchase successful. Your order of Rs. {total} has been placed.",
    )


@app.route("/api/programs")
def programs():
    conn = connect_db()
    cursor = conn.cursor()
    # Only show courses created by Gymore Team (NULL created_by)
    # OR courses created by VERIFIED trainers
    cursor.execute(
        """
        SELECT courses.*, 
               (SELECT COUNT(*) FROM enrollments WHERE course_id = courses.id) AS enrollment_count
        FROM courses
        LEFT JOIN trainer_profiles ON courses.created_by = trainer_profiles.user_id
        WHERE courses.created_by IS NULL 
           OR trainer_profiles.status = 'verified'
        ORDER BY courses.created_at DESC
        """
    )
    courses = cursor.fetchall()
    cursor.close()
    conn.close()
    return api_response({"courses": courses})


@app.route("/api/programs/<int:course_id>")
def program_detail(course_id):
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT courses.*, COUNT(enrollments.id) AS enrollment_count
        FROM courses
        LEFT JOIN enrollments ON enrollments.course_id = courses.id
        WHERE courses.id = %s
        GROUP BY courses.id
        """,
        (course_id,),
    )
    course = cursor.fetchone()

    if not course:
        cursor.close()
        conn.close()
        return api_error("Program not found.", 404)

    enrolled = False
    user = get_current_user()

    if user and user["role"] == "user":
        cursor.execute(
            "SELECT id FROM enrollments WHERE user_id = %s AND course_id = %s",
            (user["id"], course_id),
        )
        enrolled = cursor.fetchone() is not None

    cursor.close()
    conn.close()
    return api_response({"course": course, "enrolled": enrolled, "user": user})


@app.route("/api/programs/<int:course_id>/enroll", methods=["POST"])
def enroll(course_id):
    user, response = require_user_role()
    if response:
        return response

    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM courses WHERE id = %s", (course_id,))
        course = cursor.fetchone()
        if not course:
            return api_error("Program not found.", 404)

        cursor.execute(
            "INSERT INTO enrollments (user_id, course_id) VALUES (%s, %s)",
            (user["id"], course_id),
        )
        conn.commit()
    except pymysql.IntegrityError:
        return api_error("You are already enrolled in this program.", 409)
    finally:
        cursor.close()
        conn.close()

    return api_response(message="Enrollment successful.")


@app.route("/api/trainer/courses", methods=["POST"])
def create_course():
    user, response = require_trainer_role()
    if response:
        return response

    form = get_course_form_data()
    if course_form_has_empty_field(form):
        return api_error("Please fill all course fields.")

    conn = connect_db()
    cursor = conn.cursor()
    _, access_error = ensure_trainer_can_manage_content(cursor, user["id"])
    if access_error:
        cursor.close()
        conn.close()
        return access_error

    slug = get_unique_slug(cursor, form["title"])
    cursor.execute(
        """
        INSERT INTO courses (slug, title, description, duration, level, trainer_name, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            slug,
            form["title"],
            form["description"],
            form["duration"],
            form["level"],
            user["username"],
            user["id"],
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()

    return api_response(message="Course created successfully.", status=201)


@app.route("/api/trainer/courses/<int:course_id>")
def get_trainer_course(course_id):
    user, response = require_trainer_role()
    if response:
        return response

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM courses WHERE id = %s AND created_by = %s",
        (course_id, user["id"]),
    )
    course = cursor.fetchone()
    cursor.close()
    conn.close()

    if not course:
        return api_error("Course not found.", 404)

    return api_response({"course": course})


@app.route("/api/trainer/courses/<int:course_id>", methods=["PUT"])
def edit_course(course_id):
    user, response = require_trainer_role()
    if response:
        return response

    form = get_course_form_data()
    if course_form_has_empty_field(form):
        return api_error("Please fill all course fields.")

    conn = connect_db()
    cursor = conn.cursor()
    _, access_error = ensure_trainer_can_manage_content(cursor, user["id"])
    if access_error:
        cursor.close()
        conn.close()
        return access_error

    cursor.execute(
        "SELECT id FROM courses WHERE id = %s AND created_by = %s",
        (course_id, user["id"]),
    )
    course = cursor.fetchone()

    if not course:
        cursor.close()
        conn.close()
        return api_error("Course not found.", 404)

    slug = get_unique_slug(cursor, form["title"], course_id)
    cursor.execute(
        """
        UPDATE courses
        SET slug = %s, title = %s, description = %s, duration = %s, level = %s
        WHERE id = %s AND created_by = %s
        """,
        (
            slug,
            form["title"],
            form["description"],
            form["duration"],
            form["level"],
            course_id,
            user["id"],
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()

    return api_response(message="Course updated successfully.")


@app.route("/api/trainer/courses/<int:course_id>", methods=["DELETE"])
def delete_course(course_id):
    user, response = require_trainer_role()
    if response:
        return response

    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM courses WHERE id = %s AND created_by = %s",
        (course_id, user["id"]),
    )
    deleted = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()

    if deleted == 0:
        return api_error("Course not found.", 404)

    return api_response(message="Course deleted successfully.")


init_db()


if __name__ == "__main__":
    app.run(debug=True)
