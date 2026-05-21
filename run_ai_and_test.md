cd e:\Project_Flutter\t_app_BE\ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health
Invoke-WebRequest -UseBasicParsing http://localhost:3000/moderation/check -Method POST -ContentType "application/json" -Body '{"text":"xin chao"}'