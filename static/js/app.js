const state = {
  session: {
    user: null,
    cart_count: 0,
  },
  currentTrainerCourseId: null,
};

const app = document.querySelector("#app");
const flashContainer = document.querySelector("#flash-messages");
const navLinks = document.querySelector("#nav-links");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleString();
}

function showFlash(message, type = "info") {
  flashContainer.innerHTML = `<div class="alert ${type === "success" ? "alert-success" : ""}">${escapeHtml(message)}</div>`;
  window.clearTimeout(showFlash.timeoutId);
  showFlash.timeoutId = window.setTimeout(() => {
    flashContainer.innerHTML = "";
  }, 5000);
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
}

function setSession(data) {
  state.session = {
    user: data.user,
    cart_count: data.cart_count || 0,
  };
  renderNav();
}

async function loadSession() {
  const payload = await api("/api/session");
  setSession(payload.data);
}

function renderNav() {
  const { user, cart_count } = state.session;
  const links = [
    `<a href="#/programs">Programs</a>`,
    `<a href="#/bmi">BMI</a>`,
    `<a href="#/equipment">Equipment</a>`,
    `<a href="#/cart">Cart (${cart_count})</a>`,
  ];

  if (user) {
    if (user.role === "trainer") {
      links.push(`<a href="#/trainer-dashboard">Trainer Dashboard</a>`);
      links.push(`<a href="#/trainer-courses/new">Add Course</a>`);
    } else if (user.role === "admin") {
      links.push(`<a href="#/admin-dashboard">Admin Activity</a>`);
    } else {
      links.push(`<a href="#/dashboard">Dashboard</a>`);
    }

    links.push(`<a href="#" data-logout-link>Logout</a>`);
  } else {
    links.push(`<a href="#/login/user">User Login</a>`);
    links.push(`<a href="#/login/trainer">Trainer Login</a>`);
    links.push(`<a href="#/login/admin">Admin Login</a>`);
    links.push(`<a class="btn" href="#/register/user">Register</a>`);
  }

  navLinks.innerHTML = links.join("");

  const logoutLink = navLinks.querySelector("[data-logout-link]");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (event) => {
      event.preventDefault();
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      setSession({ user: null, cart_count: 0 });
      showFlash("You have been logged out.", "success");
      location.hash = "#/";
    });
  }
}

function cardGrid(itemsHtml) {
  return `<div class="grid">${itemsHtml}</div>`;
}

function statusBadge(status, label) {
  return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function courseCard(course, actionLabel = "Details") {
  return `
    <article class="card">
      <div class="card-top">
        <h3>${escapeHtml(course.title)}</h3>
        <span class="tag">${escapeHtml(course.duration)}</span>
      </div>
      <p class="muted">${escapeHtml(course.description || "")}</p>
      <p class="muted small">Trainer: ${escapeHtml(course.trainer_name)}</p>
      ${course.enrollment_count !== undefined ? `<p class="muted small">Enrolled users: ${escapeHtml(course.enrollment_count)}</p>` : ""}
      <div class="card-bottom">
        <span class="chip">${escapeHtml(course.level)}</span>
        <a class="btn" href="#/programs/${course.id}">${escapeHtml(actionLabel)}</a>
      </div>
    </article>
  `;
}

function renderHome(data) {
  const courses = data.featured_courses || [];
  const featured = courses.map((course) => courseCard(course, "View Details")).join("");

  app.innerHTML = `
    <div class="main">
      <div class="box"></div>
      <div class="hero">
        <span>Gymore helps users, trainers, and admins on one fitness platform.</span>
        <span>Register, calculate BMI, explore programs, buy equipment, and manage training content in one place.</span>
        <span>Choose your role below to get started.</span>
        <div class="hero-buttons">
          <a class="btn btn-orange" href="#/register/user">User Registration</a>
          <a class="btn" href="#/register/trainer">Trainer Registration</a>
          <a class="btn" href="#/login/admin">Admin Login</a>
        </div>
      </div>
    </div>

    <div class="separation"></div>

    <section class="first">
      <div>
        <span>Believe in the Process</span>
        <span>"The only bad workout is the one that didn't happen. Don't stop when you're tired, stop when you're done."</span>
      </div>
      <div class="simple-card">
        <h3>Start Today</h3>
        <p>Your fitness journey is a marathon, not a sprint. Every drop of sweat is a step closer to your goal.</p>
      </div>
    </section>

    <div class="separation"></div>

    <section class="first second">
      <div class="simple-card">
        <h3>Inner Strength</h3>
        <p>Strength does not come from winning. Your struggles develop your strengths. When you decide not to surrender, that is strength.</p>
      </div>
      <div>
        <span>Push Your Limits</span>
        <span>"Success is not final, failure is not fatal: it is the courage to continue that counts. Your journey starts now."</span>
      </div>
    </section>

    <div class="separation"></div>

    <section class="first">
      <div>
        <span>No Excuses</span>
        <span>"Action is the foundational key to all success. Discipline is doing what needs to be done, even when you don't feel like it."</span>
      </div>
      <div class="simple-card">
        <h3>Consistency is Key</h3>
        <p>You don't have to be great to start, but you have to start to be great. Stay consistent, stay hungry, and never give up.</p>
      </div>
    </section>

    <div class="separation"></div>

    <section class="panel home-panel">
      <div class="card-top">
        <h2>Featured Programs</h2>
        <a class="btn" href="#/programs">See All Programs</a>
      </div>
      <div class="grid home-grid">${featured}</div>
    </section>
  `;
}

function renderAuthForm(role, mode) {
  const isRegister = mode === "register";
  const isTrainer = role === "trainer";
  const isAdmin = role === "admin";

  if (isAdmin && isRegister) {
    renderNotFound();
    return;
  }

  const heading = isAdmin
    ? "Admin Login"
    : `${isTrainer ? "Trainer" : "User"} ${isRegister ? "Registration" : "Login"}`;

  const description = isAdmin
    ? "Access trainer requests and platform activity."
    : isRegister
      ? (isTrainer
        ? "Create a trainer account. New trainers must verify before uploading courses."
        : "Create your account to explore programs, calculate BMI, enroll in courses, and buy equipment.")
      : (isTrainer
        ? "Sign in to manage your trainer profile, verification request, and courses."
        : "Sign in to view your enrollments, orders, and dashboard.");

  const usernameLabel = isAdmin ? "Admin ID" : "Username";
  const usernamePlaceholder = isAdmin ? "Enter admin ID" : (isRegister ? "Choose a username" : "Enter username");

  app.innerHTML = `
    <section class="panel form center-panel">
      <h2>${heading}</h2>
      <p class="muted">${description}</p>
      <form class="form-grid" id="auth-form">
        <label>${usernameLabel}
          <input name="username" type="text" placeholder="${escapeHtml(usernamePlaceholder)}" required>
        </label>
        ${isRegister ? `
          <label>Email
            <input name="email" type="email" placeholder="Enter your email" required>
          </label>
        ` : ""}
        <label>Password
          <input name="password" type="password" placeholder="${isRegister ? "Create a password" : "Enter password"}" required>
        </label>
        <button class="btn" type="submit">${isRegister ? "Create Account" : "Login"}</button>
        ${isAdmin ? `
          <p class="muted small">Admin login uses ID <strong>123</strong> and Password <strong>1234</strong>.</p>
        ` : `
          <p class="muted">
            ${isRegister
              ? `Already registered? <a href="#/login/${role}">Sign in</a>`
              : `Need an account? <a href="#/register/${role}">Register here</a>`}
          </p>
        `}
      </form>
    </section>
  `;

  document.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    body.role = role;

    try {
      if (isRegister) {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showFlash("Account created successfully. Please sign in.", "success");
        location.hash = `#/login/${role}`;
        return;
      }

      const payload = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSession(payload.data);
      showFlash("Signed in successfully.", "success");

      if (role === "trainer") {
        location.hash = "#/trainer-dashboard";
      } else if (role === "admin") {
        location.hash = "#/admin-dashboard";
      } else {
        location.hash = "#/dashboard";
      }
    } catch (error) {
      showFlash(error.message);
    }
  });
}

function renderPrograms(data) {
  app.innerHTML = `
    <section class="panel">
      <h2>Programs</h2>
      <p class="muted">Browse the available fitness programs and open any course to see full details.</p>
      ${cardGrid(data.courses.map((course) => courseCard(course)).join(""))}
    </section>
  `;
}

function renderProgramDetail(data) {
  const { course, enrolled, user } = data;
  const actionHtml = user && user.role === "user"
    ? (enrolled
      ? `<span class="btn disabled">Already Enrolled</span>`
      : `<button class="btn" id="enroll-button" type="button">Enroll Now</button>`)
    : (!user ? `<a class="btn" href="#/login/user">Login to Enroll</a>` : "");

  app.innerHTML = `
    <section class="panel">
      <h2>${escapeHtml(course.title)}</h2>
      <p class="muted"><strong>Trainer:</strong> ${escapeHtml(course.trainer_name)}</p>
      <p class="muted"><strong>Duration:</strong> ${escapeHtml(course.duration)}</p>
      <p class="muted"><strong>Level:</strong> <span class="chip">${escapeHtml(course.level)}</span></p>
      <p>${escapeHtml(course.description)}</p>
      <p class="muted"><strong>Total Enrollments:</strong> ${escapeHtml(course.enrollment_count)}</p>
      <div class="actions">
        <a class="btn ghost" href="#/programs">Back to Programs</a>
        ${actionHtml}
      </div>
    </section>
  `;

  const button = document.querySelector("#enroll-button");
  if (button) {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/programs/${course.id}/enroll`, {
          method: "POST",
          body: "{}",
        });
        showFlash("Enrollment successful.", "success");
        navigateTo(`#/programs/${course.id}`);
      } catch (error) {
        showFlash(error.message);
      }
    });
  }
}

function renderPurchaseHistory(purchases) {
  if (!purchases.length) {
    return `<p class="muted">No equipment purchases yet.</p>`;
  }

  return purchases.map((order) => `
    <article class="card">
      <div class="card-top">
        <h3>Order #${escapeHtml(order.order_id)}</h3>
        <span class="tag">Rs. ${escapeHtml(order.total_amount)}</span>
      </div>
      <p class="muted small">Placed on ${escapeHtml(formatDate(order.created_at))}</p>
      
      <div class="shipping-details mt-1 mb-1 p-1" style="background: rgba(255,255,255,0.05); border-radius: 4px;">
        <p class="small"><strong>Ship to:</strong> ${escapeHtml(order.full_name || "N/A")}</p>
        <p class="small"><strong>Phone:</strong> ${escapeHtml(order.phone || "N/A")}</p>
        <p class="small"><strong>Address:</strong> ${escapeHtml(order.address || "N/A")}, ${escapeHtml(order.pincode || "")}</p>
      </div>

      <div class="activity-list">
        ${order.items.map((item) => `
          <div class="activity-row">
            <span>${escapeHtml(item.equipment_name)} x ${escapeHtml(item.quantity)}</span>
            <span>Rs. ${escapeHtml(item.subtotal)}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderDashboard(data) {
  const enrolledHtml = data.enrollments.length
    ? cardGrid(
        data.enrollments.map((course) => `
          <article class="card">
            <div class="card-top">
              <h3>${escapeHtml(course.title)}</h3>
              <span class="tag">${escapeHtml(course.duration)}</span>
            </div>
            <p class="muted">Trainer: ${escapeHtml(course.trainer_name)}</p>
            <p class="muted small">Enrolled on ${escapeHtml(formatDate(course.enrolled_at))}</p>
            <div class="card-bottom">
              <span class="chip">${escapeHtml(course.level)}</span>
              <a class="btn" href="#/programs/${course.id}">View</a>
            </div>
          </article>
        `).join("")
      )
    : `<p class="muted">You have not enrolled in a program yet.</p>`;

  const availableHtml = data.available_courses.length
    ? cardGrid(
        data.available_courses.map((course) => `
          <article class="card">
            <div class="card-top">
              <h3>${escapeHtml(course.title)}</h3>
              <span class="tag">${escapeHtml(course.duration)}</span>
            </div>
            <p class="muted">Trainer: ${escapeHtml(course.trainer_name)}</p>
            <div class="card-bottom">
              <span class="chip">${escapeHtml(course.level)}</span>
              <a class="btn" href="#/programs/${course.id}">View</a>
            </div>
          </article>
        `).join("")
      )
    : `<p class="muted">You are already enrolled in the latest available programs.</p>`;

  app.innerHTML = `
    <section class="panel">
      <h2>Welcome back, ${escapeHtml(data.user.username)}</h2>
      <p class="muted">This is your user dashboard. You can see your enrolled programs, available programs, and your equipment orders.</p>
      <div class="grid3">
        <article class="card">
          <h3>Total Enrollments</h3>
          <p class="muted">${escapeHtml(data.enrollments.length)} programs enrolled</p>
        </article>
        <article class="card">
          <h3>Equipment Orders</h3>
          <p class="muted">${escapeHtml(data.purchases.length)} orders placed</p>
        </article>
        <article class="card">
          <h3>Quick Access</h3>
          <p class="muted">Use the BMI calculator, browse programs, and visit the equipment store.</p>
        </article>
      </div>
    </section>
    <section class="panel">
      <div class="card-top">
        <h2>My Enrollments</h2>
        <a class="btn ghost" href="#/programs">Browse Programs</a>
      </div>
      ${enrolledHtml}
    </section>
    <section class="panel">
      <h2>Available Programs</h2>
      ${availableHtml}
    </section>
    <section class="panel">
      <h2>Equipment Order History</h2>
      <div class="grid">${renderPurchaseHistory(data.purchases)}</div>
    </section>
  `;
}

function trainerStatusMessage(profile) {
  if (profile.status === "verified") {
    return "Your trainer profile is approved. You can now upload courses and view learner activity.";
  }
  if (profile.status === "pending") {
    return "Your verification form has been sent to the admin. Please wait for approval before uploading courses.";
  }
  if (profile.status === "rejected") {
    return "Your verification request was rejected. You remain unverified and cannot submit another request.";
  }
  if (profile.status === "blacklisted") {
    return "Your account has been blacklisted by the admin for guideline violations.";
  }
  return "Your account is currently unverified. Submit the verification form before uploading courses.";
}

function renderLearnersList(course) {
  if (!course.learners.length) {
    return `<p class="muted small">No users have enrolled in this course yet.</p>`;
  }

  return `
    <div class="learner-list">
      <p class="muted small"><strong>Enrolled Users</strong></p>
      ${course.learners.map((learner) => `
        <div class="learner-item">
          <span>${escapeHtml(learner.username)} (${escapeHtml(learner.email)})</span>
          <span class="muted small">${escapeHtml(formatDate(learner.enrolled_at))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTrainerDashboard(data) {
  const profile = data.trainer_profile;

  const coursesHtml = data.courses.length
    ? cardGrid(
        data.courses.map((course) => `
          <article class="card trainer-course-card">
            <div class="card-top">
              <h3>${escapeHtml(course.title)}</h3>
              <span class="tag">${escapeHtml(course.duration)}</span>
            </div>
            <p class="muted">${escapeHtml(course.description || "")}</p>
            <p class="muted small">${escapeHtml(course.enrollment_count)} learners enrolled</p>
            ${renderLearnersList(course)}
            <div class="card-bottom">
              <span class="chip">${escapeHtml(course.level)}</span>
              <div class="actions">
                <a class="btn ghost" href="#/trainer-courses/${course.id}/edit">Edit</a>
                <button class="btn" type="button" data-delete-course="${course.id}">Delete</button>
              </div>
            </div>
          </article>
        `).join("")
      )
    : `<p class="muted">You have not published any courses yet.</p>`;

  app.innerHTML = `
    <section class="panel">
      <div class="dashboard-top">
        <div>
          <h2>Trainer Dashboard</h2>
          <p class="muted">Manage your profile, verification, courses, and learner activity from here.</p>
        </div>
        <div class="trainer-status-box">
          <span class="trainer-status-label">${escapeHtml(profile.status_label.toUpperCase())}</span>
          ${profile.status === "verified" ? `<span class="verified-badge">Verified Profile</span>` : ""}
        </div>
      </div>
      <div class="status-banner">
        <div>
          <p class="muted">${escapeHtml(trainerStatusMessage(profile))}</p>
          ${profile.review_note ? `<p class="muted small">Admin Note: ${escapeHtml(profile.review_note)}</p>` : ""}
        </div>
        <div class="actions">
          ${profile.can_verify ? `<a class="btn btn-orange" href="#/trainer-verify">Verify</a>` : ""}
          <button class="btn" type="button" id="trainer-add-course-button">${profile.can_manage_content ? "Add New Course" : "Add Course"}</button>
        </div>
      </div>
      <div class="grid3">
        <article class="card">
          <h3>Total Courses</h3>
          <p class="muted">${escapeHtml(data.totals.courses)} courses published</p>
        </article>
        <article class="card">
          <h3>Total Enrollments</h3>
          <p class="muted">${escapeHtml(data.totals.enrollments)} enrollments received</p>
        </article>
        <article class="card">
          <h3>Trainer Name</h3>
          <p class="muted">${escapeHtml(profile.full_name || data.user.username)}</p>
        </article>
      </div>
    </section>

    <section class="panel">
      <h2>My Courses</h2>
      ${coursesHtml}
    </section>
  `;

  document.querySelector("#trainer-add-course-button").addEventListener("click", () => {
    if (profile.can_manage_content) {
      navigateTo("#/trainer-courses/new");
      return;
    }
    showFlash("You must first verify your trainer account before uploading courses.");
  });

  document.querySelectorAll("[data-delete-course]").forEach((button) => {
    button.addEventListener("click", async () => {
      const courseId = button.getAttribute("data-delete-course");
      try {
        await api(`/api/trainer/courses/${courseId}`, { method: "DELETE" });
        showFlash("Course deleted successfully.", "success");
        navigateTo("#/trainer-dashboard");
      } catch (error) {
        showFlash(error.message);
      }
    });
  });
}

function renderVerificationForm(profile) {
  app.innerHTML = `
    <section class="panel form center-panel verification-panel">
      <h2>Trainer Verification Form</h2>
      <p class="muted">Answer all seven questions below. Your answers and image will be sent to the admin for review.</p>
      <div class="result">
        <p><strong>Status:</strong> ${escapeHtml(profile.status_label)}</p>
        <p class="muted">${escapeHtml(trainerStatusMessage(profile))}</p>
      </div>
      <form class="form-grid" id="verification-form" enctype="multipart/form-data">
        <label>Q1. Please enter your Full Name.
          <input name="full_name" type="text" placeholder="Enter your full name" required>
        </label>
        <label>Q2. How long have you been a trainer?
          <input name="training_experience" type="text" placeholder="Example: 4 years" required>
        </label>
        <label>Q3. Which gyms have you trained at before?
          <textarea name="previous_gyms" rows="3" placeholder="List the gyms you have worked at" required></textarea>
        </label>
        <label>Q4. How long have you been going to the gym yourself?
          <input name="gym_journey" type="text" placeholder="Example: 6 years" required>
        </label>
        <label>Q5. Will you upload free or paid courses? Or both?
          <input name="course_type" type="text" placeholder="Free / Paid / Both" required>
        </label>
        <label>Q6. Give brief description under 100 words of what will you be teaching in your courses.
          <textarea name="teaching_summary" rows="4" placeholder="Keep this under 100 words" required></textarea>
        </label>
        <label>Q7. Upload proof of authentication from previous gyms you have trained at to verify successfully. (Certificate with signatures, etc.)
          <input name="proof_image" type="file" accept="image/*" required>
        </label>
        <button class="btn btn-orange" type="submit">Send Verification Request</button>
      </form>
    </section>
  `;

  document.querySelector("#verification-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const summary = String(formData.get("teaching_summary") || "").trim();

    if (summary.split(/\s+/).filter(Boolean).length > 100) {
      showFlash("Question 6 must stay under 100 words.");
      return;
    }

    try {
      await api("/api/trainer/verification-request", {
        method: "POST",
        body: formData,
      });
      showFlash("Verification request submitted successfully. Please wait for admin review.", "success");
      navigateTo("#/trainer-dashboard");
    } catch (error) {
      showFlash(error.message);
    }
  });
}

function renderBmi() {
  app.innerHTML = `
    <section class="main bmi-main">
      <div class="box"></div>
      <section class="panel form center-panel bmi-panel">
        <h2>BMI Calculator</h2>
        <p class="muted">Enter your weight and height to calculate your Body Mass Index.</p>
        <form class="form-grid" id="bmi-form">
          <label>Weight (kg)
            <input name="weight" type="number" step="0.1" min="1" placeholder="e.g. 70" required>
          </label>
          <label>Height (cm)
            <input name="height" type="number" step="0.1" min="30" placeholder="e.g. 175" required>
          </label>
          <button class="btn primary" type="submit">Calculate</button>
        </form>
        <div class="result bmi-preview" id="bmi-preview" hidden>
          <p><strong>Live BMI:</strong> <span id="bmi-live-value">--</span></p>
          <p><strong>Category:</strong> <span class="chip" id="bmi-live-category">--</span></p>
        </div>
        <div class="result" id="bmi-result" hidden></div>
      </section>
    </section>
  `;

  const form = document.querySelector("#bmi-form");
  const weightInput = form.querySelector('input[name="weight"]');
  const heightInput = form.querySelector('input[name="height"]');
  const preview = document.querySelector("#bmi-preview");
  const liveValue = document.querySelector("#bmi-live-value");
  const liveCategory = document.querySelector("#bmi-live-category");
  const result = document.querySelector("#bmi-result");

  const getCategory = (bmi) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal";
    if (bmi < 30) return "Overweight";
    return "Obese";
  };

  const updatePreview = () => {
    const weight = Number(weightInput.value);
    const height = Number(heightInput.value);

    if (!weight || !height || height < 30) {
      preview.hidden = true;
      return;
    }

    const bmi = weight / ((height / 100) * (height / 100));
    liveValue.textContent = bmi.toFixed(1);
    liveCategory.textContent = getCategory(bmi);
    preview.hidden = false;
  };

  weightInput.addEventListener("input", updatePreview);
  heightInput.addEventListener("input", updatePreview);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());

    try {
      const payload = await api("/api/bmi", {
        method: "POST",
        body: JSON.stringify(body),
      });
      result.hidden = false;
      result.innerHTML = `
        <p><strong>Your BMI:</strong> ${escapeHtml(payload.data.bmi)}</p>
        <p><strong>Category:</strong> <span class="chip">${escapeHtml(payload.data.category)}</span></p>
      `;
    } catch (error) {
      showFlash(error.message);
    }
  });
}

function renderEquipment(data) {
  app.innerHTML = `
    <section class="panel">
      <h2>Gym Equipment Store</h2>
      <p class="muted">Add gym equipment items to your cart from this page.</p>
      ${cardGrid(
        data.items.map((item) => `
          <article class="card">
            <img class="product-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
            <h3>${escapeHtml(item.name)}</h3>
            <p class="muted">${escapeHtml(item.description)}</p>
            <p><strong>Price:</strong> Rs. ${escapeHtml(item.price)}</p>
            <div class="card-bottom">
              <span class="chip">Equipment</span>
              <button class="btn btn-orange" type="button" data-add-cart="${item.id}">Add to Cart</button>
            </div>
          </article>
        `).join("")
      )}
    </section>
  `;

  document.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const payload = await api(`/api/cart/add/${button.getAttribute("data-add-cart")}`, {
          method: "POST",
          body: "{}",
        });
        setSession({ user: state.session.user, cart_count: payload.data.cart_count });
        showFlash(payload.message, "success");
      } catch (error) {
        showFlash(error.message);
      }
    });
  });
}

function renderCart(data) {
  const itemsHtml = data.items.length
    ? `
      ${cardGrid(
        data.items.map((item) => `
          <article class="card">
            <img class="product-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
            <h3>${escapeHtml(item.name)}</h3>
            <p class="muted">${escapeHtml(item.description)}</p>
            <p><strong>Price:</strong> Rs. ${escapeHtml(item.price)}</p>
            <p><strong>Quantity:</strong> ${escapeHtml(item.quantity)}</p>
            <p><strong>Subtotal:</strong> Rs. ${escapeHtml(item.subtotal)}</p>
            <div class="card-bottom">
              <span class="chip">In Cart</span>
              <button class="btn" type="button" data-remove-cart="${item.id}">Remove</button>
            </div>
          </article>
        `).join("")
      )}
      <div id="checkout-container">
        <div class="panel cart-summary">
          <h3>Total Amount: Rs. ${escapeHtml(data.total)}</h3>
          <p class="muted">Log in as a user before buying so your order can be saved in your activity history.</p>
          <div class="actions">
            <button class="btn btn-orange" type="button" id="show-checkout-button">Proceed to Checkout</button>
          </div>
        </div>
      </div>
    `
    : `
      <p class="muted">Your cart is empty right now.</p>
      <div class="actions">
        <a class="btn btn-orange" href="#/equipment">Browse Equipment</a>
      </div>
    `;

  app.innerHTML = `
    <section class="panel cart-panel">
      <h2>My Cart</h2>
      ${itemsHtml}
    </section>
  `;

  document.querySelectorAll("[data-remove-cart]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const payload = await api(`/api/cart/remove/${button.getAttribute("data-remove-cart")}`, {
          method: "POST",
          body: "{}",
        });
        setSession({ user: state.session.user, cart_count: payload.data.cart_count });
        showFlash(payload.message, "success");
        renderCart(payload.data);
      } catch (error) {
        showFlash(error.message);
      }
    });
  });

  const showCheckoutButton = document.querySelector("#show-checkout-button");
  if (showCheckoutButton) {
    showCheckoutButton.addEventListener("click", () => {
      if (!state.session.user) {
        showFlash("Please log in to checkout.");
        navigateTo("#/login/user");
        return;
      }
      renderCheckoutForm(data);
    });
  }
}

function renderCheckoutForm(cartData) {
  const checkoutContainer = document.querySelector("#checkout-container");
  checkoutContainer.innerHTML = `
    <div class="panel checkout-panel">
      <div class="card-top">
        <h3>Shipping Details</h3>
        <span class="tag tag-orange">Step 1 of 2</span>
      </div>
      <form id="shipping-form" class="form-grid">
        <div class="grid">
          <label>Full Name
            <input type="text" name="full_name" required placeholder="John Doe">
          </label>
          <label>Phone Number
            <input type="text" name="phone" required placeholder="1234567890">
          </label>
        </div>
        <label>Shipping Address
          <textarea name="address" required rows="3" placeholder="Enter your full delivery address"></textarea>
        </label>
        <label>Pincode
          <input type="text" name="pincode" required placeholder="123456">
        </label>

        <div class="cart-summary mt-2">
          <h3>Total Amount: Rs. ${escapeHtml(cartData.total)}</h3>
          <div class="actions">
            <button class="btn ghost" type="button" onclick="location.reload()">Cancel</button>
            <button class="btn btn-orange" type="submit">Proceed to Payment</button>
          </div>
        </div>
      </form>
    </div>
  `;

  const shippingForm = document.querySelector("#shipping-form");
  shippingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(shippingForm);
    const shippingData = {
      full_name: formData.get("full_name"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      pincode: formData.get("pincode")
    };
    
    // Show Zen Payment Modal
    renderZenPaymentModal(shippingData, cartData);
  });
}

function renderZenPaymentModal(shippingData, cartData) {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); display: flex; align-items: center;
    justify-content: center; z-index: 1000; backdrop-filter: blur(5px);
  `;

  overlay.innerHTML = `
    <div class="panel payment-modal" style="width: 100%; max-width: 450px; background: #1a1a1a; border: 1px solid #333; padding: 2rem; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <h2 style="color: #ffa500; margin-bottom: 0.5rem; font-size: 1.8rem;">Zen Payment</h2>
        <p class="muted small">Secure Gateway</p>
      </div>

      <div id="payment-content">
        <div style="background: #252525; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #ffa500;">
          <p class="small mb-0">Payable to: <strong>Gymore Fitness</strong></p>
          <p class="small mb-0">Amount: <strong style="color: #ffa500;">Rs. ${escapeHtml(cartData.total)}</strong></p>
        </div>

        <form id="zen-payment-form" class="form-grid">
          <label>Card Number
            <input type="text" id="card-number" required placeholder="0000 0000 0000 0000" style="background: #000; border: 1px solid #444; color: #fff; padding: 12px;">
          </label>
          <div class="grid">
            <label>Expiry (MM/YY)
              <input type="text" id="card-expiry" required placeholder="MM/YY" style="background: #000; border: 1px solid #444; color: #fff; padding: 12px;">
            </label>
            <label>CVV
              <input type="password" id="card-cvv" required placeholder="000" style="background: #000; border: 1px solid #444; color: #fff; padding: 12px;">
            </label>
          </div>
          
          <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
            <button type="button" class="btn ghost" id="cancel-payment" style="flex: 1;">Cancel</button>
            <button type="submit" class="btn btn-orange" style="flex: 2;">Pay Now & Place Order</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Formatting logic
  const cardInput = overlay.querySelector("#card-number");
  cardInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "").substring(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(" ") || val;
    e.target.value = formatted;
  });

  const expiryInput = overlay.querySelector("#card-expiry");
  expiryInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "").substring(0, 4);
    if (val.length > 2) val = val.substring(0, 2) + "/" + val.substring(2);
    e.target.value = val;
  });

  const cvvInput = overlay.querySelector("#card-cvv");
  cvvInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").substring(0, 3);
  });

  overlay.querySelector("#cancel-payment").onclick = () => overlay.remove();

  const paymentForm = overlay.querySelector("#zen-payment-form");
  paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = paymentForm.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
      const payload = await api("/api/cart/buy", {
        method: "POST",
        body: JSON.stringify(shippingData),
      });

      // Show Success Screen
      const content = overlay.querySelector("#payment-content");
      content.innerHTML = `
        <div style="text-align: center; padding: 2rem 0;">
          <div style="width: 80px; height: 80px; background: #4caf50; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style="color: #4caf50; margin-bottom: 0.5rem;">Payment Successful!</h2>
          <p class="muted">Thank you for your purchase.</p>
          <p class="small mt-2">Redirecting to website...</p>
        </div>
      `;

      setSession({ user: state.session.user, cart_count: payload.data.cart_count });
      
      // Close and redirect after 3 seconds
      setTimeout(() => {
        overlay.remove();
        navigateTo("#/dashboard");
      }, 3000);

    } catch (error) {
      btn.disabled = false;
      btn.innerText = "Pay Now & Place Order";
      showFlash(error.message);
    }
  });
}

function renderCourseForm(mode, course = null) {
  app.innerHTML = `
    <section class="panel form center-panel">
      <h2>${mode === "edit" ? "Edit Course" : "Create Course"}</h2>
      <p class="muted">Only verified trainers can publish or edit course details.</p>
      <form class="form-grid" id="course-form">
        <label>Course Title
          <input name="title" type="text" value="${escapeHtml(course?.title || "")}" placeholder="Enter course title" required>
        </label>
        <label>Description
          <textarea name="description" rows="4" placeholder="Describe the program" required>${escapeHtml(course?.description || "")}</textarea>
        </label>
        <label>Duration
          <input name="duration" type="text" value="${escapeHtml(course?.duration || "")}" placeholder="e.g. 6 weeks" required>
        </label>
        <label>Level
          <input name="level" type="text" value="${escapeHtml(course?.level || "")}" placeholder="Beginner / Moderate / Challenging" required>
        </label>
        <button class="btn primary" type="submit">${mode === "edit" ? "Save Changes" : "Create Course"}</button>
      </form>
    </section>
  `;

  document.querySelector("#course-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      if (mode === "edit") {
        await api(`/api/trainer/courses/${state.currentTrainerCourseId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        showFlash("Course updated successfully.", "success");
      } else {
        await api("/api/trainer/courses", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showFlash("Course created successfully.", "success");
      }

      location.hash = "#/trainer-dashboard";
    } catch (error) {
      showFlash(error.message);
    }
  });
}

function renderAdminUserCards(users) {
  if (!users.length) {
    return `<p class="muted">No users found.</p>`;
  }

  return users.map((user) => `
    <article class="card">
      <div class="card-top">
        <h3>${escapeHtml(user.username)}</h3>
        <span class="tag">${escapeHtml(user.email)}</span>
      </div>
      <p class="muted small">Joined ${escapeHtml(formatDate(user.created_at))}</p>
      <div class="admin-activity-block">
        <p><strong>Course Enrollments</strong></p>
        ${user.enrollments.length ? `
          <div class="activity-list">
            ${user.enrollments.map((course) => `
              <div class="activity-row">
                <span>${escapeHtml(course.title)} with ${escapeHtml(course.trainer_name)}</span>
                <span class="muted small">${escapeHtml(formatDate(course.enrolled_at))}</span>
              </div>
            `).join("")}
          </div>
        ` : `<p class="muted small">No course enrollments yet.</p>`}
      </div>
      <div class="admin-activity-block">
        <p><strong>Equipment Purchases</strong></p>
        ${user.purchases.length ? `
          <div class="activity-list">
            ${user.purchases.map((order) => `
              <div class="order-block">
                <p class="muted small">Order #${escapeHtml(order.order_id)} on ${escapeHtml(formatDate(order.created_at))} for Rs. ${escapeHtml(order.total_amount)}</p>
                ${order.items.map((item) => `
                  <div class="activity-row">
                    <span>${escapeHtml(item.equipment_name)} x ${escapeHtml(item.quantity)}</span>
                    <span>Rs. ${escapeHtml(item.subtotal)}</span>
                  </div>
                `).join("")}
              </div>
              <div class="shipping-details mt-1 small muted" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;">
                <p><strong>To:</strong> ${escapeHtml(order.full_name || "N/A")} (${escapeHtml(order.phone || "N/A")})</p>
                <p><strong>Address:</strong> ${escapeHtml(order.address || "N/A")}, ${escapeHtml(order.pincode || "")}</p>
              </div>
            `).join("")}
          </div>
        ` : `<p class="muted small">No equipment purchases yet.</p>`}
      </div>
    </article>
  `).join("");
}

function renderAdminTrainerCards(trainers) {
  if (!trainers.length) {
    return `<p class="muted">No trainers found.</p>`;
  }

  return trainers.map((trainer) => `
    <article class="card">
      <div class="card-top">
        <h3>${escapeHtml(trainer.profile.full_name || trainer.username)}</h3>
        ${statusBadge(trainer.profile.status, trainer.profile.status_label)}
      </div>
      <p class="muted small">Username: ${escapeHtml(trainer.username)}</p>
      <p class="muted small">Email: ${escapeHtml(trainer.email)}</p>
      <p class="muted small">Courses Uploaded: ${escapeHtml(trainer.course_count)}</p>
      <p class="muted small">Total Learner Enrollments: ${escapeHtml(trainer.enrollment_count)}</p>
      ${trainer.profile.review_note ? `<p class="muted small">Admin Note: ${escapeHtml(trainer.profile.review_note)}</p>` : ""}
      <div class="admin-activity-block">
        <p><strong>Trainer Uploads</strong></p>
        ${trainer.courses.length ? `
          <div class="activity-list">
            ${trainer.courses.map((course) => `
              <div class="activity-row">
                <span>${escapeHtml(course.title)} (${escapeHtml(course.level)})</span>
                <span>${escapeHtml(course.enrollment_count)} enrollments</span>
              </div>
            `).join("")}
          </div>
        ` : `<p class="muted small">No uploaded courses yet.</p>`}
      </div>
      ${trainer.profile.status === "verified" ? `
        <div class="actions">
          <button class="btn" type="button" data-trainer-action="unverified" data-trainer-id="${trainer.id}">Unverify</button>
          <button class="btn btn-danger" type="button" data-trainer-action="blacklisted" data-trainer-id="${trainer.id}">Blacklist</button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderAdminRequestCards(requests) {
  if (!requests.length) {
    return `<p class="muted">No trainer requests yet.</p>`;
  }

  return requests.map((item) => `
    <article class="card">
      <div class="card-top">
        <h3>Request #${escapeHtml(item.id)}</h3>
        ${statusBadge(item.status, item.status_label)}
      </div>
      <p class="muted">Trainer: ${escapeHtml(item.trainer_username)}</p>
      <p class="muted small">Full Name: ${escapeHtml(item.full_name)}</p>
      <p class="muted small">Submitted: ${escapeHtml(formatDate(item.submitted_at))}</p>
      <div class="card-bottom">
        <span class="chip">Trainer Requests</span>
        <a class="btn" href="#/admin-requests/${item.id}">Open Request</a>
      </div>
    </article>
  `).join("");
}

function renderAdminDashboard(data) {
  app.innerHTML = `
    <section class="panel">
      <div class="card-top">
        <div>
          <h2>Admin Activity</h2>
          <p class="muted">Review platform activity, trainer requests, user enrollments, purchases, and trainer uploads.</p>
        </div>
        <span class="verified-badge">ADMIN</span>
      </div>
      <div class="grid3">
        <article class="card">
          <h3>Total Users</h3>
          <p class="muted">${escapeHtml(data.summary.total_users)} registered users</p>
        </article>
        <article class="card">
          <h3>Total Trainers</h3>
          <p class="muted">${escapeHtml(data.summary.total_trainers)} registered trainers</p>
        </article>
        <article class="card">
          <h3>Pending Requests</h3>
          <p class="muted">${escapeHtml(data.summary.pending_requests)} trainer requests waiting</p>
        </article>
        <article class="card">
          <h3>Verified Trainers</h3>
          <p class="muted">${escapeHtml(data.summary.verified_trainers)} approved trainers</p>
        </article>
        <article class="card">
          <h3>Total Orders</h3>
          <p class="muted">${escapeHtml(data.summary.total_orders)} equipment orders placed</p>
        </article>
        <article class="card">
          <h3>Admin Session</h3>
          <p class="muted">Logged in as ${escapeHtml(data.user.username)}</p>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="card-top">
        <h2>Trainer Requests</h2>
        <span class="chip">Open each request to accept or reject</span>
      </div>
      ${cardGrid(renderAdminRequestCards(data.trainer_requests))}
    </section>

    <section class="panel">
      <h2>User Activity</h2>
      ${cardGrid(renderAdminUserCards(data.users))}
    </section>

    <section class="panel">
      <h2>Trainer Activity</h2>
      ${cardGrid(renderAdminTrainerCards(data.trainers))}
    </section>
  `;

  document.querySelectorAll("[data-trainer-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const trainerId = button.getAttribute("data-trainer-id");
      const action = button.getAttribute("data-trainer-action");
      const label = action === "blacklisted" ? "blacklist" : "unverify";

      if (!window.confirm(`Are you sure you want to ${label} this trainer?`)) {
        return;
      }

      try {
        await api(`/api/admin/trainers/${trainerId}/status`, {
          method: "POST",
          body: JSON.stringify({ action }),
        });
        showFlash(action === "blacklisted" ? "Trainer blacklisted successfully." : "Trainer moved back to unverified.", "success");
        navigateTo("#/admin-dashboard");
      } catch (error) {
        showFlash(error.message);
      }
    });
  });
}

function renderAdminRequestDetail(data) {
  const requestItem = data.request;
  const canReview = requestItem.status === "pending";

  app.innerHTML = `
    <section class="panel">
      <div class="card-top">
        <div>
          <h2>Trainer Request #${escapeHtml(requestItem.id)}</h2>
          <p class="muted">Review the trainer's answers and proof image before choosing an action.</p>
        </div>
        ${statusBadge(requestItem.status, requestItem.status_label)}
      </div>
      <div class="request-detail">
        <div class="request-answer">
          <h3>Trainer Account</h3>
          <p><strong>Username:</strong> ${escapeHtml(requestItem.trainer_username)}</p>
          <p><strong>Email:</strong> ${escapeHtml(requestItem.trainer_email)}</p>
          <p><strong>Submitted:</strong> ${escapeHtml(formatDate(requestItem.submitted_at))}</p>
        </div>
        <div class="request-answer">
          <h3>Q1. Full Name</h3>
          <p>${escapeHtml(requestItem.full_name)}</p>
        </div>
        <div class="request-answer">
          <h3>Q2. How long have you been a trainer?</h3>
          <p>${escapeHtml(requestItem.training_experience)}</p>
        </div>
        <div class="request-answer">
          <h3>Q3. Which gyms have you trained at before?</h3>
          <p>${escapeHtml(requestItem.previous_gyms)}</p>
        </div>
        <div class="request-answer">
          <h3>Q4. How long have you been going to the gym yourself?</h3>
          <p>${escapeHtml(requestItem.gym_journey)}</p>
        </div>
        <div class="request-answer">
          <h3>Q5. Will you upload free or paid courses? Or both?</h3>
          <p>${escapeHtml(requestItem.course_type)}</p>
        </div>
        <div class="request-answer">
          <h3>Q6. Course Description</h3>
          <p>${escapeHtml(requestItem.teaching_summary)}</p>
        </div>
        <div class="request-answer">
          <h3>Q7. Proof Image</h3>
          ${requestItem.proof_image_url ? `
            <img class="proof-image" src="${escapeHtml(requestItem.proof_image_url)}" alt="Trainer proof document">
          ` : `<p class="muted">No proof image uploaded.</p>`}
        </div>
      </div>
      <div class="actions admin-request-actions">
        <a class="btn ghost" href="#/admin-dashboard">Back to Admin Activity</a>
        ${canReview ? `
          <button class="btn btn-danger" type="button" id="reject-request-button">Reject Application</button>
          <button class="btn btn-orange" type="button" id="accept-request-button">Accept Application</button>
        ` : ""}
      </div>
    </section>
  `;

  const acceptButton = document.querySelector("#accept-request-button");
  const rejectButton = document.querySelector("#reject-request-button");

  if (acceptButton) {
    acceptButton.addEventListener("click", async () => {
      try {
        await api(`/api/admin/requests/${requestItem.id}/decision`, {
          method: "POST",
          body: JSON.stringify({ decision: "accept" }),
        });
        showFlash("Trainer verified successfully.", "success");
        navigateTo("#/admin-dashboard");
      } catch (error) {
        showFlash(error.message);
      }
    });
  }

  if (rejectButton) {
    rejectButton.addEventListener("click", async () => {
      try {
        await api(`/api/admin/requests/${requestItem.id}/decision`, {
          method: "POST",
          body: JSON.stringify({ decision: "reject" }),
        });
        showFlash("Trainer request rejected successfully.", "success");
        navigateTo("#/admin-dashboard");
      } catch (error) {
        showFlash(error.message);
      }
    });
  }
}

function renderNotFound() {
  app.innerHTML = `
    <section class="panel">
      <h2>Page Not Found</h2>
      <p class="muted">The page you requested does not exist in this version of Gymore.</p>
      <div class="actions">
        <a class="btn btn-orange" href="#/">Back Home</a>
      </div>
    </section>
  `;
}

async function requireVerifiedTrainerForCourseForm() {
  const payload = await api("/api/trainer/dashboard");
  if (!payload.data.trainer_profile.can_manage_content) {
    showFlash("You must first verify your trainer account before uploading courses.");
    location.hash = "#/trainer-dashboard";
    return null;
  }

  return payload.data;
}

async function renderRoute() {
  const hash = location.hash || "#/";
  const route = hash.slice(1);
  const parts = route.split("/").filter(Boolean);

  try {
    if (route === "/") {
      const payload = await api("/api/home");
      renderHome(payload.data);
      return;
    }

    if (parts[0] === "register" && parts[1]) {
      renderAuthForm(parts[1], "register");
      return;
    }

    if (parts[0] === "login" && parts[1]) {
      renderAuthForm(parts[1], "login");
      return;
    }

    if (parts[0] === "programs" && parts.length === 1) {
      const payload = await api("/api/programs");
      renderPrograms(payload.data);
      return;
    }

    if (parts[0] === "programs" && parts[1]) {
      const payload = await api(`/api/programs/${parts[1]}`);
      renderProgramDetail(payload.data);
      return;
    }

    if (parts[0] === "dashboard") {
      const payload = await api("/api/dashboard");
      renderDashboard(payload.data);
      return;
    }

    if (parts[0] === "trainer-dashboard") {
      const payload = await api("/api/trainer/dashboard");
      renderTrainerDashboard(payload.data);
      return;
    }

    if (parts[0] === "trainer-verify") {
      const payload = await api("/api/trainer/dashboard");
      if (!payload.data.trainer_profile.can_verify) {
        showFlash(trainerStatusMessage(payload.data.trainer_profile));
        location.hash = "#/trainer-dashboard";
        return;
      }
      renderVerificationForm(payload.data.trainer_profile);
      return;
    }

    if (parts[0] === "admin-dashboard") {
      const payload = await api("/api/admin/dashboard");
      renderAdminDashboard(payload.data);
      return;
    }

    if (parts[0] === "admin-requests" && parts[1]) {
      const payload = await api(`/api/admin/requests/${parts[1]}`);
      renderAdminRequestDetail(payload.data);
      return;
    }

    if (parts[0] === "bmi") {
      renderBmi();
      return;
    }

    if (parts[0] === "equipment") {
      const payload = await api("/api/equipment");
      renderEquipment(payload.data);
      return;
    }

    if (parts[0] === "cart") {
      const payload = await api("/api/cart");
      renderCart(payload.data);
      return;
    }

    if (parts[0] === "trainer-courses" && parts[1] === "new") {
      const trainerData = await requireVerifiedTrainerForCourseForm();
      if (!trainerData) {
        return;
      }
      renderCourseForm("create");
      return;
    }

    if (parts[0] === "trainer-courses" && parts[1] && parts[2] === "edit") {
      const trainerData = await requireVerifiedTrainerForCourseForm();
      if (!trainerData) {
        return;
      }
      state.currentTrainerCourseId = parts[1];
      const payload = await api(`/api/trainer/courses/${parts[1]}`);
      renderCourseForm("edit", payload.data.course);
      return;
    }

    renderNotFound();
  } catch (error) {
    if (error.message.toLowerCase().includes("admin")) {
      location.hash = "#/login/admin";
      showFlash(error.message);
      return;
    }

    if (error.message.toLowerCase().includes("trainer")) {
      location.hash = "#/login/trainer";
      showFlash(error.message);
      return;
    }

    if (error.message.includes("Please log in")) {
      location.hash = "#/login/user";
      showFlash(error.message);
      return;
    }

    app.innerHTML = `
      <section class="panel">
        <h2>Something went wrong</h2>
        <p class="muted">${escapeHtml(error.message)}</p>
        <div class="actions">
          <a class="btn btn-orange" href="#/">Back Home</a>
        </div>
      </section>
    `;
  }
}

function navigateTo(hash) {
  if (location.hash === hash) {
    renderRoute();
    return;
  }

  location.hash = hash;
}

window.addEventListener("hashchange", renderRoute);

loadSession()
  .then(renderRoute)
  .catch((error) => {
    app.innerHTML = `
      <section class="panel">
        <h2>Unable to start Gymore</h2>
        <p class="muted">${escapeHtml(error.message)}</p>
      </section>
    `;
  });
