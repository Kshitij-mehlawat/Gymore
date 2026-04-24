import requests
import os

BASE_URL = "http://127.0.0.1:5000"

def test_trainer_flow():
    session = requests.Session()
    
    # 1. Register trainer
    print("\n--- Registering Trainer ---")
    reg_data = {
        "username": "trainer_test_final",
        "email": "trainer_final@test.com",
        "password": "password123",
        "confirm_password": "password123",
        "role": "trainer"
    }
    resp = session.post(f"{BASE_URL}/api/auth/register", json=reg_data)
    print(f"Register: {resp.json()}")

    # 2. Login as trainer
    print("\n--- Login as Trainer ---")
    login_data = {"username": "trainer_test_final", "password": "password123", "role": "trainer"}
    resp = session.post(f"{BASE_URL}/api/auth/login", json=login_data)
    print(f"Login: {resp.json()}")
    
    trainer_id = resp.json()['data']['user']['id']

    # 3. Try to upload course (should fail)
    print("\n--- Uploading Course (Unverified) ---")
    course_data = {
        "title": "Unverified Course",
        "description": "This should fail",
        "duration": "1 week",
        "level": "Beginner"
    }
    resp = session.post(f"{BASE_URL}/api/trainer/courses", json=course_data)
    print(f"Upload Result: {resp.json()}")

    # 4. Submit verification
    print("\n--- Submitting Verification ---")
    # We need to simulate multipart form data for the file upload
    # Q7 is proof_image
    files = {
        'proof_image': ('test.png', b'fake-image-data', 'image/png')
    }
    form_data = {
        'full_name': 'Test Trainer',
        'training_experience': '5 years',
        'previous_gyms': 'Gym A, Gym B',
        'gym_journey': '10 years',
        'course_type': 'Both',
        'teaching_summary': 'I teach fitness.'
    }
    resp = session.post(f"{BASE_URL}/api/trainer/verification-request", data=form_data, files=files)
    print(f"Verification Submit: {resp.json()}")

    # 5. Admin Login and Review
    print("\n--- Admin Review ---")
    admin_session = requests.Session()
    admin_session.post(f"{BASE_URL}/api/auth/login", json={"username": "123", "password": "1234", "role": "admin"})
    
    dash_resp = admin_session.get(f"{BASE_URL}/api/admin/dashboard")
    requests_list = dash_resp.json()['data']['trainer_requests']
    print(f"Pending Requests: {len(requests_list)}")
    
    if requests_list:
        req_id = requests_list[0]['id']
        # Accept request
        resp = admin_session.post(f"{BASE_URL}/api/admin/requests/{req_id}/decision", json={"decision": "accept"})
        print(f"Admin Review Action: {resp.json()}")

    # 6. Try to upload course again (should succeed)
    print("\n--- Uploading Course (Verified) ---")
    resp = session.post(f"{BASE_URL}/api/trainer/courses", json=course_data)
    print(f"Upload Result: {resp.json()}")

    # 7. Admin Unverify Trainer
    print("\n--- Admin Unverify Trainer ---")
    resp = admin_session.post(f"{BASE_URL}/api/admin/trainers/{trainer_id}/status", json={"action": "unverified"})
    print(f"Unverify Result: {resp.json()}")

    # 8. Try to upload course again (should fail)
    print("\n--- Uploading Course (Unverified again) ---")
    resp = session.post(f"{BASE_URL}/api/trainer/courses", json=course_data)
    print(f"Upload Result: {resp.json()}")

    # 9. Admin Blacklist Trainer
    print("\n--- Admin Blacklist Trainer ---")
    resp = admin_session.post(f"{BASE_URL}/api/admin/trainers/{trainer_id}/status", json={"action": "blacklisted"})
    print(f"Blacklist Result: {resp.json()}")

    # 10. Try to login as blacklisted trainer (optional, but let's check status)
    print("\n--- Checking Blacklisted Status ---")
    resp = session.get(f"{BASE_URL}/api/trainer/dashboard")
    print(f"Dashboard Status: {resp.json()['data']['trainer_profile']['status']}")

if __name__ == "__main__":
    test_trainer_flow()
