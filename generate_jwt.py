import jwt
import time

import os
private_key_path = '/Users/Aditya/Desktop/PROCTORING/dev-keys/jwt-private.pem'
private_key = open(private_key_path, 'r').read()

payload = {
    "user_id": "test-user-001",
    "exam_schedule_id": "exam-sched-456",
    "tenant_id": "tenant-789",
    "attempt_no": 1,
    "exp": int(time.time()) + 3600,
    "iat": int(time.time())
}

token = jwt.encode(payload, private_key, algorithm="RS256")
print(token)
