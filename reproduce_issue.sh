#!/bin/bash
set -e

API_URL="http://localhost:8080"
EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="password123"
USERNAME="user_$(date +%s)"
NEW_USERNAME="new_user_$(date +%s)"

echo "1. Signing up..."
curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"username\": \"$USERNAME\", \"display_name\": \"Test User\"}"
echo -e "\nSignup complete."

echo "2. Logging in..."
curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}"
echo -e "\nLogin complete."

echo "3. Updating profile (CHANGING USERNAME to $NEW_USERNAME)..."
curl -s -v -X POST "$API_URL/user/profile" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"display_name\": \"Updated Name\", \"username\": \"$NEW_USERNAME\"}" 2>&1 | grep "HTTP/"

echo "4. Verifying session AFTER update..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/user/me" -b cookies.txt)
echo "Status code: $STATUS"

if [ "$STATUS" == "200" ]; then
    echo "SUCCESS: Still logged in."
else
    echo "FAILURE: Logged out (Status $STATUS)."
fi
