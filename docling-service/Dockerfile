FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Docling
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render will set PORT env var)
EXPOSE ${PORT:-8000}

# Run the service (Render provides PORT env var)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}


