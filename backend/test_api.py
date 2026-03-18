import requests
import json

base_url = "http://127.0.0.1:8000"

print("1. Registering new test user...")
try:
    res = requests.post(f"{base_url}/api/auth/register", json={
        "name": "Integration Test",
        "email": "integration@test.com",
        "password": "password"
    })
    
    if res.status_code != 200:
        print(f"Register failed with status {res.status_code}: {res.text}")
        # Try login if already registered
        res = requests.post(f"{base_url}/api/auth/login", json={
            "email": "integration@test.com",
            "password": "password"
        })
        if res.status_code != 200:
            print(f"Login also failed: {res.text}")
            
    token = res.json().get("access_token")
    if not token:
        raise ValueError("No access token found in response")
        
    print(f"Token acquired. Status: {res.status_code}")
except Exception as e:
    print(f"Auth failed: {e}")
    exit(1)

print("\n2. Getting User Profile...")
try:
    res = requests.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    print(f"Profile: {res.json()}")
except Exception as e:
    print(f"Profile failed: {e}")

print("\n3. Uploading Sample Dataset...")
try:
    with open("sample_dataset.csv", "rb") as f:
        res = requests.post(
            f"{base_url}/api/audit/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("sample_dataset.csv", f, "text/csv")}
        )
    print(f"Upload response status: {res.status_code}")
    print(json.dumps(res.json(), indent=2))
except Exception as e:
    print(f"Upload failed: {e}")

print("\n4. Getting past reports...")
try:
    res = requests.get(f"{base_url}/api/audit/reports", headers={"Authorization": f"Bearer {token}"})
    reports = res.json()
    print(f"Found {len(reports)} reports.")
    if len(reports) > 0:
        print(f"Latest report grade: {reports[0].get('grade')}")
except Exception as e:
    print(f"Reports failed: {e}")

print("\nTest complete.")
