#!/usr/bin/env bash
# Claude Code session-start hook — bootstraps .env files from Supabase secrets.
# Requires SUPABASE_SERVICE_ROLE_KEY in the Claude Code environment variables field.
set -euo pipefail

# Tell Claude Code to run this hook asynchronously (60s timeout)
echo '{"async": true, "asyncTimeout": 60000}'

SUPABASE_URL="https://ytxncykyfbhoyvxkocrs.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eG5jeWt5ZmJob3l2eGtvY3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDAxNTksImV4cCI6MjA4ODkxNjE1OX0.WTS3_Rp6khE1jVibtfFZMn5yC10eP8rxdNf1_DXRJkY"

# Fetch all secrets from Supabase (service role bypasses RLS)
SECRETS=$(curl -sf \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  "${SUPABASE_URL}/rest/v1/secrets?select=key,value")

get_secret() {
  echo "$SECRETS" | jq -r --arg k "$1" '.[] | select(.key==$k) | .value // ""'
}

RENDER_API_KEY=$(get_secret "render_api_key")
ANTHROPIC_API_KEY=$(get_secret "anthropic_api_key")
OPENAI_API_KEY=$(get_secret "openai_api_key")

# Fetch REDIS_URL from Render (not stored in secrets table)
RENDER_ENVS=$(curl -sf \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  "https://api.render.com/v1/services/srv-d72p7jvfte5s73a5lbrg/env-vars" || echo "[]")
REDIS_URL=$(echo "$RENDER_ENVS" | jq -r '.[] | select(.envVar.key=="REDIS_URL") | .envVar.value // ""')
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

# Write frontend/.env.local
cat > "${CLAUDE_PROJECT_DIR}/frontend/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
NEXT_PUBLIC_API_URL=https://dnd-backend-xk1o.onrender.com
EOF

# Write backend/.env
cat > "${CLAUDE_PROJECT_DIR}/backend/.env" <<EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
REDIS_URL=${REDIS_URL}
EOF

# Export all vars into the Claude Code session environment
{
  echo "SUPABASE_URL=${SUPABASE_URL}"
  echo "SUPABASE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
  echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
  echo "OPENAI_API_KEY=${OPENAI_API_KEY}"
  echo "REDIS_URL=${REDIS_URL}"
  echo "NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}"
  echo "NEXT_PUBLIC_API_URL=https://dnd-backend-xk1o.onrender.com"
} >> "${CLAUDE_ENV_FILE}"

echo "✓ Environment bootstrapped from Supabase secrets" >&2
